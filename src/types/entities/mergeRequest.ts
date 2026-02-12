import { z } from "zod";
import {
	MergeRequestStatusSchema,
	PlatformSchema,
	TimestampSchema,
} from "../index.js";

// T018: MergeRequestエンティティ型定義

/**
 * マージリクエスト（PR/MRメタデータ）
 * mergeRequestId format: {platform}:{owner}/{repo}#{number}
 */
export const MergeRequestSchema = z.object({
	/** PR/MR ID (PK) - format: {platform}:{owner}/{repo}#{number} */
	mergeRequestId: z.string().min(1),

	/** プラットフォーム */
	platform: PlatformSchema,

	/** リポジトリオーナー */
	owner: z.string().min(1),

	/** リポジトリ名 */
	repo: z.string().min(1),

	/** PR/MR番号 */
	number: z.number().int().positive(),

	/** 作成者ID (FK) */
	authorAccountId: z.string().min(1),

	/** タイトル */
	title: z.string().min(1),

	/** 差分の要約 */
	diffSummary: z.string().optional(),

	/** 変更ファイル一覧 */
	filesChanged: z.array(z.string()).optional(),

	/** ステータス */
	status: MergeRequestStatusSchema,

	/** 作成日時 */
	createdAt: TimestampSchema,
});

export type MergeRequest = z.infer<typeof MergeRequestSchema>;

/** マージリクエスト作成時の入力型 */
export const CreateMergeRequestInputSchema = z.object({
	platform: PlatformSchema,
	owner: z.string().min(1),
	repo: z.string().min(1),
	number: z.number().int().positive(),
	authorAccountId: z.string().min(1),
	title: z.string().min(1),
	diffSummary: z.string().optional(),
	filesChanged: z.array(z.string()).optional(),
});

export type CreateMergeRequestInput = z.infer<
	typeof CreateMergeRequestInputSchema
>;

/**
 * mergeRequestIdを生成するヘルパー関数
 * Firestoreのドキュメントパスで使用できる形式
 * 形式: {platform}_{owner}_{repo}_{number}
 */
export function createMergeRequestId(
	platform: string,
	owner: string,
	repo: string,
	number: number,
): string {
	return `${platform}_${owner}_${repo}_${number}`;
}
