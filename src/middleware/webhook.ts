import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// T027-1: Webhook署名検証ミドルウェア
// GitHub/GitLabからのリクエストを検証

/**
 * 署名検証エラー
 */
export class WebhookVerificationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WebhookVerificationError";
	}
}

/**
 * HMAC-SHA256署名を計算
 */
function computeSignature(secret: string, payload: string): string {
	return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

/**
 * タイミング攻撃対策の署名比較
 */
function verifySignature(expected: string, actual: string): boolean {
	try {
		const expectedBuffer = Buffer.from(expected);
		const actualBuffer = Buffer.from(actual);

		if (expectedBuffer.length !== actualBuffer.length) {
			return false;
		}

		return timingSafeEqual(expectedBuffer, actualBuffer);
	} catch {
		return false;
	}
}

/**
 * Webhook署名検証ミドルウェア
 *
 * - WEBHOOK_SECRET未設定時: 検証スキップ（ローカル開発用）
 * - IAM認証（Authorizationヘッダー）がある場合: 検証スキップ（Cloud Run IAM認証に任せる）
 * - GitHub: X-Hub-Signature-256 ヘッダーで検証
 * - GitLab: X-Gitlab-Token ヘッダーで検証（シンプルトークン比較）
 */
export async function webhookVerificationMiddleware(c: Context, next: Next) {
	const secret = env.WEBHOOK_SECRET;

	// シークレット未設定時はスキップ
	if (!secret) {
		logger.debug("Webhook verification skipped: WEBHOOK_SECRET not set");
		return next();
	}

	// IAM認証（Authorizationヘッダー）がある場合はスキップ
	// GitHub Actions経由のリクエストなど、Cloud RunのIAM認証を使用する場合
	const authHeader = c.req.header("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		logger.debug(
			"Webhook verification skipped: IAM authentication (Authorization header) present",
		);
		return next();
	}

	// リクエストボディを取得
	const body = await c.req.text();

	// GitHub署名検証（X-Hub-Signature-256）
	const githubSignature = c.req.header("X-Hub-Signature-256");
	if (githubSignature) {
		const expectedSignature = computeSignature(secret, body);

		if (!verifySignature(expectedSignature, githubSignature)) {
			logger.warn("Webhook verification failed: GitHub signature mismatch");
			return c.json({ error: "Invalid webhook signature" }, 401);
		}

		logger.debug("Webhook verification passed: GitHub signature valid");
		// ボディを再利用可能にするためリクエストを再構築
		c.req.raw = new Request(c.req.raw.url, {
			method: c.req.raw.method,
			headers: c.req.raw.headers,
			body,
		});
		return next();
	}

	// GitLab署名検証（X-Gitlab-Token）
	const gitlabToken = c.req.header("X-Gitlab-Token");
	if (gitlabToken) {
		if (!verifySignature(secret, gitlabToken)) {
			logger.warn("Webhook verification failed: GitLab token mismatch");
			return c.json({ error: "Invalid webhook token" }, 401);
		}

		logger.debug("Webhook verification passed: GitLab token valid");
		// ボディを再利用可能にするためリクエストを再構築
		c.req.raw = new Request(c.req.raw.url, {
			method: c.req.raw.method,
			headers: c.req.raw.headers,
			body,
		});
		return next();
	}

	// 署名ヘッダーがない場合
	logger.warn("Webhook verification failed: No signature header provided");
	return c.json({ error: "Missing webhook signature" }, 401);
}
