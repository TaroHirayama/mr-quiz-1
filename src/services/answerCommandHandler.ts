import {
	createAnswer,
	updateUserStats,
	updateSkillStats,
	checkAndCreateMilestones,
	getSkillStatsByUser,
	getAnswersByUser,
	getUserProfile,
} from "./firestore.js";
import { generateLearningRecommendations } from "./personalization.js";
import type { Quiz } from "../types/entities/quiz.js";
import type { Answer } from "../types/entities/answer.js";
import type { SkillStats } from "../types/entities/skillStats.js";
import type { GrowthMilestone } from "../types/entities/growthMilestone.js";
import type { Category } from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * 回答コマンドハンドラー
 * /answer コマンドの処理とメッセージ生成
 */

/**
 * 回答コマンド処理結果
 */
export interface AnswerCommandResult {
	success: boolean;
	isCorrect: boolean;
	quiz: Quiz;
	answer: Answer;
	stats: SkillStats[];
	newMilestones: GrowthMilestone[];
	message: string;
	alreadyAnswered?: boolean;
}

/**
 * /answer コマンドを処理
 */
export async function handleAnswerCommand(
	accountId: string,
	quiz: Quiz,
	answerIndex: number,
): Promise<AnswerCommandResult> {
	try {
		logger.info("Handling answer command", {
			accountId,
			quizId: quiz.quizId,
			answerIndex,
		});

		// 既に回答済みかチェック
		const existingAnswers = await getAnswersByUser(accountId);
		const userAnswer = existingAnswers.find(
			(a: Answer) => a.quizId === quiz.quizId,
		);

		if (userAnswer) {
			logger.info("User already answered this quiz", {
				accountId,
				quizId: quiz.quizId,
			});

			// 既回答メッセージ
			const stats = await getSkillStatsByUser(accountId);
			const message = formatAlreadyAnsweredMessage(quiz, userAnswer, stats);

			return {
				success: true,
				isCorrect: userAnswer.isCorrect,
				quiz,
				answer: userAnswer,
				stats,
				newMilestones: [],
				message,
				alreadyAnswered: true,
			};
		}

		// 正誤判定
		const isCorrect = answerIndex === quiz.correctAnswerIndex;

		// 回答を保存
		const answer = await createAnswer(
			{
				quizId: quiz.quizId,
				accountId,
				selectedAnswerIndex: answerIndex,
			},
			quiz,
		);

		// ユーザー統計を更新
		await updateUserStats(accountId, isCorrect);

		// スキル統計を更新（カテゴリ別）
		await updateSkillStats({
			accountId,
			category: quiz.category,
			difficulty: quiz.difficulty,
			isCorrect,
		});

		// スキル統計を取得
		const stats = await getSkillStatsByUser(accountId);

		// マイルストーン（簡易版 - エラー時はスキップ）
		const newMilestones: GrowthMilestone[] = [];
		// TODO: checkAndCreateMilestones の引数を調整

		// メッセージ生成
		const message = isCorrect
			? await formatCorrectAnswerMessage(quiz, answer, stats, newMilestones)
			: await formatIncorrectAnswerMessage(quiz, answer, stats, accountId);

		logger.info("Answer command completed", {
			accountId,
			quizId: quiz.quizId,
			isCorrect,
			newMilestonesCount: newMilestones.length,
		});

		return {
			success: true,
			isCorrect,
			quiz,
			answer,
			stats,
			newMilestones,
			message,
		};
	} catch (error) {
		logger.error("Failed to handle answer command", {
			error,
			accountId,
			quizId: quiz.quizId,
			answerIndex,
		});

		throw error;
	}
}

/**
 * 回答結果メッセージを生成（正解）
 */
async function formatCorrectAnswerMessage(
	quiz: Quiz,
	answer: Answer,
	stats: SkillStats[],
	newMilestones: GrowthMilestone[],
): Promise<string> {
	// カテゴリの日本語表記
	const categoryMap = {
		bug_fix: "バグ修正",
		performance: "パフォーマンス",
		refactoring: "リファクタリング",
		security: "セキュリティ",
		logic: "ロジック",
	};

	// 難易度の日本語表記
	const difficultyMap = {
		easy: "易しい",
		medium: "普通",
		hard: "難しい",
	};

	const selectedOption = quiz.options[answer.selectedAnswerIndex];
	const correctOption = quiz.options[quiz.correctAnswerIndex];

	// スキル統計サマリー
	const totalQuizzes = stats.reduce((sum, s) => sum + s.totalQuizzes, 0);
	const totalCorrect = stats.reduce((sum, s) => sum + s.correctCount, 0);
	const overallCorrectRate = totalQuizzes > 0 ? (totalCorrect / totalQuizzes) * 100 : 0;

	// カテゴリ別正答率
	const categoryStats = stats
		.sort((a, b) => b.correctRate - a.correctRate)
		.slice(0, 3)
		.map((s) => `  - ${categoryMap[s.category]}: ${(s.correctRate * 100).toFixed(1)}%`)
		.join("\n");

	// マイルストーンセクション
	const milestonesSection =
		newMilestones.length > 0
			? `\n\n---\n\n🎉 **新しいマイルストーン達成！**\n${newMilestones.map((m) => `- ${m.achievement}`).join("\n")}`
			: "";

	return `## ✅ 正解です！

**あなたの回答:** ${answer.selectedAnswerIndex + 1}. ${selectedOption}
**正解:** ${quiz.correctAnswerIndex + 1}. ${correctOption}

**カテゴリ:** ${categoryMap[quiz.category]}
**難易度:** ${difficultyMap[quiz.difficulty]}

### 📖 解説
${quiz.explanation}

### 📊 あなたの成績
- 累計回答数: ${totalQuizzes}問
- 正答率: ${overallCorrectRate.toFixed(1)}%
- カテゴリ別正答率（上位3つ）:
${categoryStats || "  - データなし"}${milestonesSection}

---
*回答日時: ${new Date(answer.answeredAt.seconds * 1000).toLocaleString("ja-JP")}*`;
}

/**
 * 回答結果メッセージを生成（不正解）
 */
async function formatIncorrectAnswerMessage(
	quiz: Quiz,
	answer: Answer,
	stats: SkillStats[],
	accountId: string,
): Promise<string> {
	// カテゴリの日本語表記
	const categoryMap = {
		bug_fix: "バグ修正",
		performance: "パフォーマンス",
		refactoring: "リファクタリング",
		security: "セキュリティ",
		logic: "ロジック",
	};

	// 難易度の日本語表記
	const difficultyMap = {
		easy: "易しい",
		medium: "普通",
		hard: "難しい",
	};

	const selectedOption = quiz.options[answer.selectedAnswerIndex];
	const correctOption = quiz.options[quiz.correctAnswerIndex];

	// スキル統計サマリー
	const totalQuizzes = stats.reduce((sum, s) => sum + s.totalQuizzes, 0);
	const totalCorrect = stats.reduce((sum, s) => sum + s.correctCount, 0);
	const overallCorrectRate = totalQuizzes > 0 ? (totalCorrect / totalQuizzes) * 100 : 0;

	// 学習推奨を取得
	const profile = await getUserProfile(accountId);
	const recommendations = await generateLearningRecommendations(profile, stats);

	// 苦手カテゴリ
	const weakCategories = recommendations.weakAreas
		.slice(0, 2)
		.map((w: { category: Category; correctRate: number; priority: string }) =>
			categoryMap[w.category],
		)
		.join(", ");

	return `## ❌ 不正解です

**あなたの回答:** ${answer.selectedAnswerIndex + 1}. ${selectedOption}
**正解:** ${quiz.correctAnswerIndex + 1}. ${correctOption}

**カテゴリ:** ${categoryMap[quiz.category]}
**難易度:** ${difficultyMap[quiz.difficulty]}

### 📖 解説
${quiz.explanation}

### 📊 あなたの成績
- 累計回答数: ${totalQuizzes}問
- 正答率: ${overallCorrectRate.toFixed(1)}%

### 💡 おすすめ学習
${weakCategories ? `苦手カテゴリ: ${weakCategories}` : ""}
${recommendations.nextSteps.slice(0, 2).map((step: string) => `- ${step}`).join("\n")}

---
*回答日時: ${new Date(answer.answeredAt.seconds * 1000).toLocaleString("ja-JP")}*
*次のクイズで頑張りましょう！*`;
}

/**
 * 既に回答済みのメッセージを生成
 */
function formatAlreadyAnsweredMessage(
	quiz: Quiz,
	answer: Answer,
	stats: SkillStats[],
): string {
	const resultEmoji = answer.isCorrect ? "✅" : "❌";
	const resultText = answer.isCorrect ? "正解" : "不正解";
	const selectedOption = quiz.options[answer.selectedAnswerIndex];

	const totalQuizzes = stats.reduce((sum, s) => sum + s.totalQuizzes, 0);
	const totalCorrect = stats.reduce((sum, s) => sum + s.correctCount, 0);
	const overallCorrectRate = totalQuizzes > 0 ? (totalCorrect / totalQuizzes) * 100 : 0;

	return `## ℹ️ 既に回答済みです

このクイズには既に回答しています。

**あなたの回答:** ${answer.selectedAnswerIndex + 1}. ${selectedOption} ${resultEmoji} (${resultText})
**回答日時:** ${new Date(answer.answeredAt.seconds * 1000).toLocaleString("ja-JP")}

### 📊 現在の成績
- 累計回答数: ${totalQuizzes}問
- 正答率: ${overallCorrectRate.toFixed(1)}%

---
*新しいPRを作成すると新しいクイズが出題されます*`;
}

/**
 * クイズが見つからないエラーメッセージ
 */
export function formatQuizNotFoundMessage(): string {
	return `## ❌ クイズが見つかりません

このPRに関連するクイズが見つかりませんでした。

クイズIDを明示的に指定する場合:
\`\`\`
/answer 2 quiz_abc123
\`\`\`

または、PRにクイズが投稿されていることを確認してください。`;
}

/**
 * 無効な回答番号のエラーメッセージ
 */
export function formatInvalidAnswerMessage(): string {
	return `## ❌ 無効な回答です

回答は 1〜4 の数値で指定してください。

**正しい形式:**
\`\`\`
/answer 2
\`\`\`

**例:**
- \`/answer 1\` - 選択肢1を選択
- \`/answer 3\` - 選択肢3を選択`;
}

/**
 * 一般的なエラーメッセージ
 */
export function formatAnswerErrorMessage(error: string): string {
	return `## ❌ 回答処理エラー

回答の処理中にエラーが発生しました：

\`\`\`
${error}
\`\`\`

しばらく時間をおいて再度お試しください。`;
}
