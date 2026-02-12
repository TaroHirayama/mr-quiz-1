import { z } from "zod";

// T008: 共通型定義

/** プラットフォーム */
export const PlatformSchema = z.enum(["github", "gitlab"]);
export type Platform = z.infer<typeof PlatformSchema>;

/** クイズカテゴリ */
export const CategorySchema = z.enum([
	"bug_fix",
	"performance",
	"refactoring",
	"security",
	"logic",
]);
export type Category = z.infer<typeof CategorySchema>;

/** 難易度 */
export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

/** クイズステータス */
export const QuizStatusSchema = z.enum([
	"pending",
	"answered",
	"skipped",
	"expired",
]);
export type QuizStatus = z.infer<typeof QuizStatusSchema>;

/** マージリクエストステータス */
export const MergeRequestStatusSchema = z.enum(["open", "merged", "closed"]);
export type MergeRequestStatus = z.infer<typeof MergeRequestStatusSchema>;

/** Firestoreタイムスタンプ型 */
export const TimestampSchema = z.object({
	seconds: z.number(),
	nanoseconds: z.number(),
});
export type Timestamp = z.infer<typeof TimestampSchema>;
