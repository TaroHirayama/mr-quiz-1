import "dotenv/config";
import { z } from "zod";

// T010: 環境変数管理モジュール
// ローカル開発: .env ファイルから読み込み
// 本番環境: Secret Manager から読み込み（将来実装）

const EnvSchema = z.object({
	/** APIサーバーポート */
	PORT: z.coerce.number().default(3000),

	/** Google Cloud Project ID (also used for Vertex AI authentication) */
	GOOGLE_CLOUD_PROJECT: z.string().min(1),

	/** Firestore Emulator Host (ローカル開発用) */
	FIRESTORE_EMULATOR_HOST: z.string().optional(),

	/** Node環境 */
	NODE_ENV: z.enum(["development", "production"]).default("development"),

	/** Webhook Secret（GitHub/GitLab署名検証用、未設定時はスキップ） */
	WEBHOOK_SECRET: z.string().min(1).optional(),

	/** Bot App ID（GitHub App認証用） */
	BOT_APP_ID: z.coerce.number().optional(),

	/** Bot App Private Key（GitHub App認証用） */
	BOT_APP_PRIVATE_KEY: z.string().min(1).optional(),

	/** GitLab Personal Access Token（MR差分取得、コメント投稿用） */
	GITLAB_TOKEN: z.string().min(1).optional(),

	/** Bot動作のベースURL（PRコメント内のリンク用） */
	APP_BASE_URL: z.string().url().optional().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
	const result = EnvSchema.safeParse(process.env);

	if (!result.success) {
		const errors = result.error.flatten().fieldErrors;
		const missing = Object.entries(errors)
			.map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
			.join("\n");
		throw new Error(`Missing or invalid environment variables:\n${missing}`);
	}

	return result.data;
}

export const env = loadEnv();

/** Emulator使用中かどうか */
export const isEmulator = (): boolean => !!env.FIRESTORE_EMULATOR_HOST;

/** 本番環境かどうか */
export const isProduction = (): boolean => env.NODE_ENV === "production";
