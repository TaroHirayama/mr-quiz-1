import { z } from "zod";
import { PlatformSchema, TimestampSchema } from "../index.js";

// T015: Userエンティティ型定義

/**
 * ユーザー（開発者アカウント）
 * プライバシー制約: メールアドレス・氏名は保持しない
 */
export const UserSchema = z.object({
	/** GitHub/GitLabアカウントID (PK) */
	accountId: z.string().min(1),

	/** プラットフォーム */
	platform: PlatformSchema,

	/** 累積回答数 */
	totalQuizzes: z.number().int().min(0).default(0),

	/** 正答数 */
	correctCount: z.number().int().min(0).default(0),

	/** 作成日時 */
	createdAt: TimestampSchema,

	/** 更新日時 */
	updatedAt: TimestampSchema,
});

export type User = z.infer<typeof UserSchema>;

/** ユーザー作成時の入力型 */
export const CreateUserInputSchema = UserSchema.pick({
	accountId: true,
	platform: true,
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

/** ユーザー統計更新時の入力型 */
export const UpdateUserStatsInputSchema = z.object({
	isCorrect: z.boolean(),
});

export type UpdateUserStatsInput = z.infer<typeof UpdateUserStatsInputSchema>;
