import { getQuizzesCollection } from "./firestore.js";
import type { Quiz } from "../types/entities/quiz.js";
import { logger } from "../utils/logger.js";

/**
 * クイズ検索サービス
 * PRに紐づくクイズを特定する
 */

/**
 * PRに紐づく最新のクイズを取得
 */
export async function getLatestQuizForPR(
	owner: string,
	repo: string,
	prNumber: number,
): Promise<Quiz | null> {
	try {
		logger.info("Searching for quiz", { owner, repo, prNumber });

		// MergeRequestコレクションから該当PRを検索
		const { getMergeRequestsCollection } = await import("./firestore.js");
		const mergeRequestsRef = getMergeRequestsCollection();

		const mrSnapshot = await mergeRequestsRef
			.where("platform", "==", "github")
			.where("owner", "==", owner)
			.where("repo", "==", repo)
			.where("number", "==", prNumber)
			.limit(1)
			.get();

		if (mrSnapshot.empty) {
			logger.warn("MergeRequest not found", { owner, repo, prNumber });
			return null;
		}

		const mergeRequestId = mrSnapshot.docs[0].id;
		const mergeRequestData = mrSnapshot.docs[0].data();
		logger.info("MergeRequest found", { 
			mergeRequestId, 
			owner, 
			repo, 
			prNumber,
			mrData: mergeRequestData 
		});

		// そのMergeRequestに紐づく最新のクイズを取得
		const quizzesRef = getQuizzesCollection();
		logger.info("Querying quizzes", { mergeRequestId });
		
		const quizSnapshot = await quizzesRef
			.where("mergeRequestId", "==", mergeRequestId)
			.orderBy("createdAt", "desc")
			.limit(1)
			.get();

		logger.info("Quiz query completed", { 
			empty: quizSnapshot.empty, 
			size: quizSnapshot.size,
			mergeRequestId 
		});

		if (quizSnapshot.empty) {
			logger.warn("Quiz not found for MergeRequest", {
				mergeRequestId,
				owner,
				repo,
				prNumber,
			});
			return null;
		}

		const quizData = quizSnapshot.docs[0].data();
		const quiz = quizData as Quiz;

		logger.info("Found quiz", {
			quizId: quiz.quizId,
			mergeRequestId,
			owner,
			repo,
			prNumber,
		});

		return quiz;
	} catch (error) {
		logger.error("Failed to get latest quiz for PR", {
			error,
			owner,
			repo,
			prNumber,
		});
		return null;
	}
}

/**
 * PRコメントからQuiz IDを抽出
 * コメント内の "Quiz ID: `quiz_xxx`" または UUID形式のIDを探す
 */
export function extractQuizIdFromComment(
	commentBody: string,
): string | null {
	try {
		// パターン1: Quiz ID: `xxx` (バッククォート内)
		const pattern1 = /Quiz ID:\s*`([^`]+)`/i;
		const match1 = commentBody.match(pattern1);
		if (match1) {
			return match1[1];
		}

		// パターン2: /answer コマンドの第2引数（UUID形式）
		// 例: /answer 1 eb6577c1-43cd-4c80-a5f5-081998520d88
		const pattern2 = /\/answer\s+\d+\s+([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
		const match2 = commentBody.match(pattern2);
		if (match2) {
			return match2[1];
		}

		// パターン3: quiz_xxx 形式（後方互換）
		const pattern3 = /\bquiz_[a-zA-Z0-9]+\b/;
		const match3 = commentBody.match(pattern3);
		if (match3) {
			return match3[0];
		}

		// パターン4: UUID単独（コメント内のどこかにある）
		const pattern4 = /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i;
		const match4 = commentBody.match(pattern4);
		if (match4) {
			return match4[1];
		}

		return null;
	} catch (error) {
		logger.error("Failed to extract quiz ID from comment", {
			error,
			commentBody,
		});
		return null;
	}
}

/**
 * コメントまたはPR情報からQuizを特定
 */
export async function findQuizForAnswer(
	commentBody: string,
	owner: string,
	repo: string,
	prNumber: number,
): Promise<Quiz | null> {
	// 1. コメント内からQuiz IDを抽出
	const quizId = extractQuizIdFromComment(commentBody);

	if (quizId) {
		// Quiz IDが見つかった場合、直接取得
		const { getQuiz } = await import("./firestore.js");
		const quiz = await getQuiz(quizId);

		if (quiz) {
			logger.info("Found quiz by ID from comment", { quizId });
			return quiz;
		}

		logger.warn("Quiz ID found in comment but quiz not found", { quizId });
	}

	// 2. Quiz IDが見つからない or 存在しない場合、PRから最新を取得
	const quiz = await getLatestQuizForPR(owner, repo, prNumber);

	if (quiz) {
		logger.info("Found latest quiz for PR", {
			quizId: quiz.quizId,
			owner,
			repo,
			prNumber,
		});
		return quiz;
	}

	logger.warn("No quiz found for answer command", {
		owner,
		repo,
		prNumber,
	});

	return null;
}
