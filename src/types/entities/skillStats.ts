import { z } from "zod";
import { CategorySchema, TimestampSchema } from "../index.js";

// スキル統計型定義

/**
 * スキル統計
 * カテゴリごとの正答率、成長率などを管理
 */
export const SkillStatsSchema = z.object({
	/** 統計ID (PK, UUID) */
	statId: z.string().uuid(),

	/** ユーザーID (FK) */
	accountId: z.string().min(1),

	/** カテゴリ */
	category: CategorySchema,

	/** 回答数 */
	totalQuizzes: z.number().int().min(0).default(0),

	/** 正答数 */
	correctCount: z.number().int().min(0).default(0),

	/** 正答率 (0.0-1.0) */
	correctRate: z.number().min(0).max(1).default(0),

	/** 平均難易度 (1.0-3.0: easy=1, medium=2, hard=3) */
	averageDifficulty: z.number().min(1).max(3).default(1),

	/** 最終回答日時 */
	lastAnsweredAt: TimestampSchema.optional(),

	/** 週次成長率 (-1.0 to 1.0) */
	weeklyTrend: z.number().min(-1).max(1).default(0),

	/** 月次成長率 (-1.0 to 1.0) */
	monthlyTrend: z.number().min(-1).max(1).default(0),

	/** 計算日時 */
	calculatedAt: TimestampSchema,
});

export type SkillStats = z.infer<typeof SkillStatsSchema>;

/**
 * スキル統計更新時の入力型
 */
export const UpdateSkillStatsInputSchema = z.object({
	accountId: z.string().min(1),
	category: CategorySchema,
	isCorrect: z.boolean(),
	difficulty: z.enum(["easy", "medium", "hard"]),
});

export type UpdateSkillStatsInput = z.infer<typeof UpdateSkillStatsInputSchema>;
