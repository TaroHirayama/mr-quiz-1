import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

// T014-1: レートリミットミドルウェア
// DDoS対策、Cloud Runリソース保護

/** レートリミット設定 */
const RATE_LIMIT_CONFIG = {
	/** ウィンドウ時間（ミリ秒） - 1分 */
	windowMs: 60 * 1000,
	/** ウィンドウあたりの最大リクエスト数 */
	limit: 30,
} as const;

/**
 * キー生成関数
 * X-API-Key ヘッダーがあればそれを使用、なければIPアドレス
 */
function keyGenerator(c: Context): string {
	const apiKey = c.req.header("X-API-Key");
	if (apiKey) {
		return `api-key:${apiKey}`;
	}

	// X-Forwarded-For ヘッダー（プロキシ経由の場合）
	const forwarded = c.req.header("X-Forwarded-For");
	if (forwarded) {
		return `ip:${forwarded.split(",")[0].trim()}`;
	}

	// X-Real-IP ヘッダー（nginx等）
	const realIp = c.req.header("X-Real-IP");
	if (realIp) {
		return `ip:${realIp}`;
	}

	// フォールバック
	return "ip:unknown";
}

/**
 * レートリミットミドルウェア
 *
 * - 1分あたり30リクエストに制限
 * - X-API-Key ヘッダーまたはIPアドレスで識別
 * - RateLimit-* ヘッダーを返却
 */
export const rateLimitMiddleware = rateLimiter({
	windowMs: RATE_LIMIT_CONFIG.windowMs,
	limit: RATE_LIMIT_CONFIG.limit,
	standardHeaders: "draft-6",
	keyGenerator,
});
