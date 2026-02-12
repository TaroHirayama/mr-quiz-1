import { z } from "zod";
import { CategorySchema, TimestampSchema } from "../index.js";

// 成長マイルストーン型定義

/**
 * マイルストーンタイプ
 */
export const MilestoneTypeSchema = z.enum([
	"first_correct", // 初めての正解
	"category_master", // カテゴリ正答率80%達成
	"streak_achievement", // 連続正解記録
	"difficulty_unlock", // 新しい難易度に挑戦
	"total_milestone", // 累計回答数マイルストーン
]);

export type MilestoneType = z.infer<typeof MilestoneTypeSchema>;

/**
 * 成長マイルストーン
 * ユーザーの成長過程での重要な達成を記録
 */
export const GrowthMilestoneSchema = z.object({
	/** マイルストーンID (PK, UUID) */
	milestoneId: z.string().uuid(),

	/** ユーザーID (FK) */
	accountId: z.string().min(1),

	/** マイルストーンタイプ */
	type: MilestoneTypeSchema,

	/** 関連カテゴリ（該当する場合） */
	category: CategorySchema.optional(),

	/** 達成内容の説明 */
	achievement: z.string().min(1).max(200),

	/** メタデータ（JSONフリーフォーマット） */
	metadata: z.record(z.string(), z.unknown()).optional(),

	/** 達成日時 */
	achievedAt: TimestampSchema,
});

export type GrowthMilestone = z.infer<typeof GrowthMilestoneSchema>;

/**
 * マイルストーン作成時の入力型
 */
export const CreateGrowthMilestoneInputSchema = z.object({
	accountId: z.string().min(1),
	type: MilestoneTypeSchema,
	category: CategorySchema.optional(),
	achievement: z.string().min(1).max(200),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateGrowthMilestoneInput = z.infer<
	typeof CreateGrowthMilestoneInputSchema
>;
