import { z } from "zod";
import { CategorySchema, TimestampSchema } from "../index.js";

// ユーザープロファイル型定義

/**
 * 経験レベル
 */
export const ExperienceLevelSchema = z.enum(["junior", "mid", "senior"]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;

/**
 * 自己評価（1-5のスケール）
 */
export const SelfAssessmentSchema = z.record(
	CategorySchema,
	z.number().int().min(1).max(5),
);
export type SelfAssessment = z.infer<typeof SelfAssessmentSchema>;

/**
 * ユーザープロファイル
 * キャリア目標、経験レベル、注力分野、自己評価を管理
 */
export const UserProfileSchema = z.object({
	/** ユーザーID (PK, FK to User) */
	accountId: z.string().min(1),

	/** キャリア目標（なりたいエンジニア像） */
	careerGoal: z.string().max(500).optional(),

	/** 経験レベル */
	experienceLevel: ExperienceLevelSchema,

	/** 経験年数 */
	yearsOfExperience: z.number().min(0),

	/** 注力したい学習分野（最大5つ） */
	focusAreas: z.array(CategorySchema).max(5).default([]),

	/** 自己評価（カテゴリごとの1-5評価） */
	selfAssessment: SelfAssessmentSchema.optional(),

	/** 作成日時 */
	createdAt: TimestampSchema,

	/** 更新日時 */
	updatedAt: TimestampSchema,
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * ユーザープロファイル作成時の入力型
 */
export const CreateUserProfileInputSchema = z.object({
	accountId: z.string().min(1),
	careerGoal: z.string().max(500).optional(),
	experienceLevel: ExperienceLevelSchema,
	yearsOfExperience: z.number().min(0),
	focusAreas: z.array(CategorySchema).max(5).optional(),
	selfAssessment: SelfAssessmentSchema.optional(),
});

export type CreateUserProfileInput = z.infer<
	typeof CreateUserProfileInputSchema
>;

/**
 * ユーザープロファイル更新時の入力型
 */
export const UpdateUserProfileInputSchema = z.object({
	careerGoal: z.string().max(500).optional(),
	experienceLevel: ExperienceLevelSchema.optional(),
	yearsOfExperience: z.number().min(0).optional(),
	focusAreas: z.array(CategorySchema).max(5).optional(),
	selfAssessment: SelfAssessmentSchema.optional(),
});

export type UpdateUserProfileInput = z.infer<
	typeof UpdateUserProfileInputSchema
>;
