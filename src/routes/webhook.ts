import { Hono } from "hono";
import { env } from "../config/env.js";
import { ValidationError } from "../middleware/error.js";
import { webhookVerificationMiddleware } from "../middleware/webhook.js";
import {
	checkAndCreateMilestones,
	createMergeRequest,
	createQuiz,
	getOrCreateUser,
	getUserProfile,
	updateUserStats,
} from "../services/firestore.js";
import { generateQuizFromDiff } from "../services/gemini.js";
import {
	fetchPRDiff,
	formatErrorComment,
	formatQuizComment,
	postPRComment,
} from "../services/github.js";
import { findQuizForAnswer } from "../services/quizLookup.js";
import {
	handleProfileCommand,
	formatProfileErrorMessage,
} from "../services/profileCommandHandler.js";
import {
	handleAnswerCommand,
	formatAnswerErrorMessage,
	formatInvalidAnswerMessage,
	formatQuizNotFoundMessage,
} from "../services/answerCommandHandler.js";
import {
	type ExtractedPRInfo,
	type GitHubPullRequestEvent,
	type GitHubIssueCommentEvent,
	extractPRInfo,
	isGitHubPullRequestEvent,
	isGitHubIssueCommentEvent,
	isPullRequestComment,
	shouldGenerateQuiz,
} from "../types/webhook.js";
import {
	detectCommandType,
	parseProfileCommand,
	parseAnswerCommand,
	getProfileCommandHelp,
} from "../utils/commandParser.js";
import { logger } from "../utils/logger.js";

/**
 * Webhookルーティング
 * GitHub/GitLabからのWebhookを受信してクイズを自動生成
 */

const webhookRoutes = new Hono();

// Webhook署名検証ミドルウェア
webhookRoutes.use("*", webhookVerificationMiddleware);

/**
 * GitHub Webhook エンドポイント
 * PR作成時・更新時にクイズを自動生成してコメント投稿
 * PRコメント時にコマンドを処理
 */
webhookRoutes.post("/github", async (c) => {
	try {
		// NOTE: このルートはレガシーです。GitHub App統合により、
		// GitHub Actions経由でCloud Runを呼び出す方式に変更されました。
		// このルートは後方互換性のために残されています。

		// イベントタイプ確認
		const eventType = c.req.header("X-GitHub-Event");

		// PRコメントイベント処理
		if (eventType === "issue_comment") {
			return handleIssueCommentEvent(c);
		}

		// PRイベント処理（既存）
		if (eventType !== "pull_request") {
			logger.info(`Ignoring GitHub event: ${eventType}`);
			return c.json({ message: "Event ignored" }, 200);
		}

		// ペイロード解析
		const payload = await c.req.json();

		if (!isGitHubPullRequestEvent(payload)) {
			logger.warn("Invalid GitHub pull_request payload", { payload });
			throw new ValidationError("Invalid pull_request payload");
		}

		// クイズ生成が必要なイベントか確認
		if (!shouldGenerateQuiz(payload)) {
			logger.info(`Ignoring PR action: ${payload.action}`);
			return c.json({ message: "Action ignored" }, 200);
		}

		// PR情報を抽出
		const prInfo = extractPRInfo(payload);
		logger.info("Received GitHub PR webhook", { ...prInfo });

		// クイズ生成処理を非同期で実行（Webhookレスポンスは即座に返す）
		// NOTE: 本番環境ではCloud TasksやPub/Subなどのキューイングシステムを使用することを推奨
		processQuizGeneration(prInfo, payload).catch((error) => {
			logger.error("Quiz generation failed", { error, prInfo });
		});

		return c.json({
			message: "Quiz generation started",
			pr: `${prInfo.owner}/${prInfo.repo}#${prInfo.number}`,
		});
	} catch (error) {
		logger.error("GitHub webhook error", { error });

		if (error instanceof ValidationError) {
			return c.json({ error: error.message }, 400);
		}

		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * GitLab Webhook エンドポイント（将来実装）
 */
webhookRoutes.post("/gitlab", async (c) => {
	logger.info("GitLab webhook received (not implemented yet)");
	return c.json({ message: "GitLab webhook support coming soon" }, 501);
});

/**
 * GitHub issue_comment イベント処理
 * PRコメントでのコマンド実行
 */
async function handleIssueCommentEvent(c: any): Promise<Response> {
	// NOTE: このルートはレガシーです。GitHub App統合により、
	// comment-relay.yml経由で /api/comment/process にリクエストが送られるようになりました。
	// このルートは後方互換性のために残されています。
	logger.info("Legacy webhook route called - use /api/comment/process instead");
	return c.json({
		message: "This route is deprecated. Use /api/comment/process instead.",
	}, 200);
}

/**
 * プロファイルコマンドをPRコメントで処理
 */
export async function handleProfileCommandInComment(
	owner: string,
	repo: string,
	prNumber: number,
	accountId: string,
	commentBody: string,
	installationId: number,
): Promise<void> {
	try {
		// コマンド解析
		const command = parseProfileCommand(commentBody);

		if (!command) {
			// パース失敗
			const errorMsg = formatProfileErrorMessage(
				"コマンドの形式が正しくありません",
				"パラメータの値を確認してください",
			);

			if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
				await postPRComment(owner, repo, prNumber, errorMsg, installationId);
			}
			return;
		}

		// 空のコマンド（ヘルプ表示）
		if (Object.keys(command).length === 0) {
			const helpMsg = getProfileCommandHelp();
			if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
				await postPRComment(owner, repo, prNumber, helpMsg, installationId);
			}
			return;
		}

		// プロファイル更新
		const result = await handleProfileCommand(accountId, command);

		// 結果をコメント
		if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
			await postPRComment(owner, repo, prNumber, result.message, installationId);
		}

		logger.info("Profile command completed", {
			owner,
			repo,
			prNumber,
			accountId,
			success: result.success,
		});
	} catch (error) {
		logger.error("Failed to handle profile command in comment", {
			error,
			owner,
			repo,
			prNumber,
			accountId,
		});

		// エラーメッセージを投稿
		if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
			const errorMsg = formatProfileErrorMessage(
				"プロファイルの更新中にエラーが発生しました",
				"しばらく時間をおいて再度お試しください",
			);
			await postPRComment(owner, repo, prNumber, errorMsg, installationId);
		}
	}
}

/**
 * 回答コマンドをPRコメントで処理
 */
export async function handleAnswerCommandInComment(
	owner: string,
	repo: string,
	prNumber: number,
	accountId: string,
	commentBody: string,
	installationId: number,
): Promise<void> {
	try {
		logger.info("Starting answer command handling", {
			owner,
			repo,
			prNumber,
			accountId,
		});

		// コマンド解析
		const answerIndex = parseAnswerCommand(commentBody);
		logger.info("Answer command parsed", { answerIndex });

		if (answerIndex === null) {
			// パース失敗
			logger.warn("Answer command parse failed");
			const errorMsg = formatInvalidAnswerMessage();

			if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
				await postPRComment(owner, repo, prNumber, errorMsg, installationId);
			}
			return;
		}

		// PRに関連するクイズを検索
		logger.info("Searching for quiz", { owner, repo, prNumber });
		const quiz = await findQuizForAnswer(commentBody, owner, repo, prNumber);
		logger.info("Quiz search completed", { found: !!quiz });

		if (!quiz) {
			// クイズが見つからない
			logger.warn("Quiz not found for PR", { owner, repo, prNumber });
			const errorMsg = formatQuizNotFoundMessage();

			if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
				await postPRComment(owner, repo, prNumber, errorMsg, installationId);
			}
			return;
		}

		// 回答処理
		logger.info("Processing answer", { quizId: quiz.quizId, answerIndex });
		const result = await handleAnswerCommand(accountId, quiz, answerIndex);
		logger.info("Answer processed", { success: result.success });

		// 結果をコメント
		if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
			logger.info("Posting result comment");
			await postPRComment(owner, repo, prNumber, result.message, installationId);
			logger.info("Result comment posted");
		}

		logger.info("Answer command completed", {
			owner,
			repo,
			prNumber,
			accountId,
			quizId: quiz.quizId,
			answerIndex,
			success: result.success,
		});
	} catch (error) {
		logger.error("Failed to handle answer command in comment", {
			error,
			owner,
			repo,
			prNumber,
			accountId,
		});

		// エラーメッセージを投稿
		if (env.BOT_APP_ID && env.BOT_APP_PRIVATE_KEY) {
			const errorMsg = formatAnswerErrorMessage(
				error instanceof Error ? error.message : "不明なエラー",
			);
			await postPRComment(owner, repo, prNumber, errorMsg, installationId);
		}
	}
}

/**
 * クイズ生成処理（非同期）
 */
async function processQuizGeneration(
	prInfo: ExtractedPRInfo,
	payload: GitHubPullRequestEvent,
): Promise<void> {
	const { platform, owner, repo, number, accountId, title } = prInfo;

	try {
		logger.info("Starting quiz generation process", { owner, repo, number });

		let diff: string;

		// NOTE: このルートはレガシーです。GitHub App統合により、
		// webhook-relay.yml経由でクイズ生成が行われるようになりました。
		logger.warn("Legacy webhook route - quiz generation via GitHub Actions is recommended");

		// テスト用のモックdiff（実際のPRを模擬）
		diff = `diff --git a/src/auth/login.js b/src/auth/login.js
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/auth/login.js
@@ -0,0 +1,35 @@
+const bcrypt = require('bcrypt');
+const jwt = require('jsonwebtoken');
+const User = require('../models/User');
+
+async function login(email, password) {
+  // ユーザーを検索
+  const user = await User.findByEmail(email);
+  if (!user) {
+    throw new Error('User not found');
+  }
+
+  // パスワードを検証
+  const isValid = await bcrypt.compare(password, user.passwordHash);
+  if (!isValid) {
+    throw new Error('Invalid password');
+  }
+
+  // JWTトークンを生成
+  const token = jwt.sign(
+    { userId: user.id, email: user.email },
+    process.env.JWT_SECRET,
+    { expiresIn: '24h' }
+  );
+
+  return {
+    token,
+    user: {
+      id: user.id,
+      email: user.email,
+      name: user.name
+    }
+  };
+}
+
+module.exports = { login };
`;

		if (!diff || diff.trim().length === 0) {
			logger.warn("PR diff is empty, skipping quiz generation", {
				owner,
				repo,
				number,
			});
			return;
		}

		// 2. ユーザー取得または作成
		logger.info("Getting or creating user", { accountId, platform });
		const user = await getOrCreateUser({
			accountId,
			platform,
		});
		logger.info("User retrieved", { accountId: user.accountId });

		// 3. MergeRequestレコード作成
		logger.info("Creating merge request record", { owner, repo, number });
		const mergeRequest = await createMergeRequest({
			platform,
			owner,
			repo,
			number,
			title,
			authorAccountId: accountId,
		});
		logger.info("Merge request created", {
			mergeRequestId: mergeRequest.mergeRequestId,
		});

		// 4. Gemini APIでクイズ生成
		logger.info("Generating quiz with Gemini", { owner, repo, number });
		const quizData = await generateQuizFromDiff(diff);

		// 5. Firestoreにクイズを保存
		const quiz = await createQuiz({
			mergeRequestId: mergeRequest.mergeRequestId,
			accountId,
			generatedQuiz: quizData,
		});

		logger.info("Quiz created successfully", {
			quizId: quiz.quizId,
			mergeRequestId: mergeRequest.mergeRequestId,
		});

		// 6. プロファイル存在チェック（初回ユーザー向けガイド表示判定）
		const profile = await getUserProfile(accountId);
		const showProfileGuide = !profile;

		// 7. PRにコメント投稿
		// NOTE: レガシールートのため、コメント投稿はスキップ
		logger.info("Skipping PR comment (legacy webhook route)", {
			owner,
			repo,
			number,
			quizId: quiz.quizId,
		});

		// 8. ユーザー統計は回答時に更新されるため、ここではスキップ
		// updateUserStats は回答時に呼ばれる

		// 8. マイルストーンチェックも回答時に実行されるため、ここではスキップ
		// checkAndCreateMilestones は回答時に呼ばれる

		logger.info("Quiz generation completed successfully", {
			quizId: quiz.quizId,
			owner,
			repo,
			number,
		});
	} catch (error) {
		logger.error("Failed to generate quiz", {
			error,
			errorType: error?.constructor?.name,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
			prInfo,
		});

		// NOTE: レガシールートのため、エラーコメント投稿はスキップ
		throw error;
	}
}

export default webhookRoutes;
