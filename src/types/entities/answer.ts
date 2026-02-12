import { z } from "zod";
import { CategorySchema, DifficultySchema, TimestampSchema } from "../index.js";

// T017: Answerエンティティ型定義

/**
 * 回答履歴
 */
export const AnswerSchema = z.object({
	/** 回答ID (PK, UUID) */
	answerId: z.string().uuid(),

	/** クイズID (FK) */
	quizId: z.string().uuid(),

	/** ユーザーID (FK) */
	accountId: z.string().min(1),

	/** PR/MR ID */
	mergeRequestId: z.string().min(1),

	/** 選択した回答 (0-3) */
	selectedAnswerIndex: z.number().int().min(0).max(3),

	/** 正誤判定 */
	isCorrect: z.boolean(),

	/** カテゴリ（非正規化） */
	category: CategorySchema,

	/** 難易度（非正規化） */
	difficulty: DifficultySchema,

	/** 回答日時 */
	answeredAt: TimestampSchema,
});

export type Answer = z.infer<typeof AnswerSchema>;

/** 回答作成時の入力型 */
export const CreateAnswerInputSchema = z.object({
	quizId: z.string().uuid(),
	accountId: z.string().min(1),
	selectedAnswerIndex: z.number().int().min(0).max(3),
});

export type CreateAnswerInput = z.infer<typeof CreateAnswerInputSchema>;
