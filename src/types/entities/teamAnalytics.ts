import { z } from "zod";
import { CategorySchema, TimestampSchema } from "../index.js";
import { ExperienceLevelSchema } from "./userProfile.js";

// チーム分析型定義

/**
 * チーム分析データ
 * 期間別のチーム全体の統計（マテリアライズドビュー的な役割）
 */
export const TeamAnalyticsSchema = z.object({
	/** 分析ID (PK) */
	analyticsId: z.string().min(1),

	/** 期間（YYYY-MM形式） */
	period: z.string().regex(/^\d{4}-\d{2}$/),

	/** 経験レベル（全体の場合はnull） */
	experienceLevel: ExperienceLevelSchema.optional(),

	/** カテゴリ（全体の場合はnull） */
	category: CategorySchema.optional(),

	/** 平均正答率 */
	avgCorrectRate: z.number().min(0).max(1),

	/** 総クイズ数 */
	totalQuizzes: z.number().int().min(0),

	/** アクティブユーザー数 */
	activeUsers: z.number().int().min(0),

	/** 25パーセンタイル正答率 */
	percentile25: z.number().min(0).max(1),

	/** 50パーセンタイル正答率（中央値） */
	percentile50: z.number().min(0).max(1),

	/** 75パーセンタイル正答率 */
	percentile75: z.number().min(0).max(1),

	/** 90パーセンタイル正答率 */
	percentile90: z.number().min(0).max(1),

	/** 計算日時 */
	calculatedAt: TimestampSchema,
});

export type TeamAnalytics = z.infer<typeof TeamAnalyticsSchema>;

/**
 * チーム分析クエリ用の入力型
 */
export const TeamAnalyticsQuerySchema = z.object({
	period: z.string().regex(/^\d{4}-\d{2}$/),
	experienceLevel: ExperienceLevelSchema.optional(),
	category: CategorySchema.optional(),
});

export type TeamAnalyticsQuery = z.infer<typeof TeamAnalyticsQuerySchema>;
