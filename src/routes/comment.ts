import { Hono } from "hono";
import { z } from "zod";
import { ValidationError } from "../middleware/error.js";
import { webhookVerificationMiddleware } from "../middleware/webhook.js";
import {
	handleAnswerCommandInComment,
	handleProfileCommandInComment,
} from "./webhook.js";
import { detectCommandType } from "../utils/commandParser.js";
import { logger } from "../utils/logger.js";

/**
 * Comment処理ルーティング
 * GitHub Actionsからのリレーリクエストを受信してコマンドを処理
 */

const commentRoutes = new Hono();

// Webhook署名検証ミドルウェア（IAM認証をサポート）
commentRoutes.use("*", webhookVerificationMiddleware);

/**
 * リクエストスキーマ
 */
const ProcessCommentRequestSchema = z.object({
	owner: z.string().min(1),
	repo: z.string().min(1),
	prNumber: z.number().int().positive(),
	accountId: z.string().min(1),
	commentBody: z.string().min(1),
	installationId: z.number().int().positive(),
});

type ProcessCommentRequest = z.infer<typeof ProcessCommentRequestSchema>;

/**
 * POST /api/comment/process
 * GitHub Actionsからのコメント処理リクエストを受信
 */
commentRoutes.post("/process", async (c) => {
	try {
		// リクエストボディを解析
		const body = await c.req.json();

		// スキーマ検証
		const validationResult = ProcessCommentRequestSchema.safeParse(body);

		if (!validationResult.success) {
			logger.warn("Invalid comment processing request", {
				errors: validationResult.error.issues,
				body,
			});
			throw new ValidationError(
				`Invalid request: ${validationResult.error.issues
					.map((e) => `${String(e.path.join("."))}: ${e.message}`)
					.join(", ")}`,
			);
		}

		const { owner, repo, prNumber, accountId, commentBody, installationId } =
			validationResult.data;

		logger.info("Processing comment command from GitHub Actions", {
			owner,
			repo,
			prNumber,
			accountId,
			installationId,
		});

		// コマンドタイプを判定
		const commandType = detectCommandType(commentBody);

		if (!commandType) {
			logger.info("No command detected in comment, skipping");
			return c.json({
				success: true,
				commandType: null,
				message: "No command detected",
			});
		}

		logger.info("Command detected", { commandType });

		// コマンド処理を実行
		try {
			if (commandType === "profile") {
				await handleProfileCommandInComment(
					owner,
					repo,
					prNumber,
					accountId,
					commentBody,
					installationId,
				);
			} else if (commandType === "answer") {
				await handleAnswerCommandInComment(
					owner,
					repo,
					prNumber,
					accountId,
					commentBody,
					installationId,
				);
			}

			logger.info("Command processed successfully", { commandType });

			return c.json({
				success: true,
				commandType,
				message: "Command processed successfully",
			});
		} catch (cmdError) {
			logger.error("Command processing failed", {
				error: cmdError,
				commandType,
				owner,
				repo,
				prNumber,
			});

			// エラーでもHTTP 200を返す（GitHub Actionsのリトライを防ぐ）
			return c.json({
				success: false,
				commandType,
				message:
					cmdError instanceof Error ? cmdError.message : "Command processing failed",
			});
		}
	} catch (error) {
		logger.error("Comment processing error", {
			error,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : undefined,
		});

		if (error instanceof ValidationError) {
			return c.json({ error: error.message }, 400);
		}

		return c.json({ error: "Internal server error" }, 500);
	}
});

export { commentRoutes };
