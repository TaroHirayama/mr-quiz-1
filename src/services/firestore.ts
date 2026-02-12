import { FieldValue, Firestore, Timestamp } from "@google-cloud/firestore";
import { v4 as uuidv4 } from "uuid";
import { env, isEmulator } from "../config/env.js";
import type { Answer, CreateAnswerInput } from "../types/entities/answer.js";
import type {
	CreateMergeRequestInput,
	MergeRequest,
} from "../types/entities/mergeRequest.js";
import type { CreateQuizInput, Quiz } from "../types/entities/quiz.js";
import type { CreateUserInput, User } from "../types/entities/user.js";
import type { Platform, QuizStatus } from "../types/index.js";
import { logger } from "../utils/logger.js";

// T011: Firestoreクライアント初期化とコレクション定義

let firestoreInstance: Firestore | null = null;

export function getFirestore(): Firestore {
	if (firestoreInstance) {
		return firestoreInstance;
	}

	if (isEmulator()) {
		logger.info("Connecting to Firestore Emulator", {
			host: env.FIRESTORE_EMULATOR_HOST,
		});
	}

	firestoreInstance = new Firestore({
		projectId: env.GOOGLE_CLOUD_PROJECT,
		ignoreUndefinedProperties: true,
	});

	return firestoreInstance;
}

// コレクション名定数
export const Collections = {
	USERS: "users",
	QUIZZES: "quizzes",
	ANSWERS: "answers",
	MERGE_REQUESTS: "mergeRequests",
	USER_PROFILES: "userProfiles",
	SKILL_STATS: "skillStats",
	GROWTH_MILESTONES: "growthMilestones",
	TEAM_ANALYTICS: "teamAnalytics",
} as const;

// コレクション参照取得ヘルパー
export function getUsersCollection() {
	return getFirestore().collection(Collections.USERS);
}

export function getQuizzesCollection() {
	return getFirestore().collection(Collections.QUIZZES);
}

export function getAnswersCollection() {
	return getFirestore().collection(Collections.ANSWERS);
}

export function getMergeRequestsCollection() {
	return getFirestore().collection(Collections.MERGE_REQUESTS);
}

export function getUserProfilesCollection() {
	return getFirestore().collection(Collections.USER_PROFILES);
}

export function getSkillStatsCollection() {
	return getFirestore().collection(Collections.SKILL_STATS);
}

export function getGrowthMilestonesCollection() {
	return getFirestore().collection(Collections.GROWTH_MILESTONES);
}

export function getTeamAnalyticsCollection() {
	return getFirestore().collection(Collections.TEAM_ANALYTICS);
}

// =============================================================================
// T019: ユーザー操作メソッド
// =============================================================================

/**
 * ユーザーを取得または作成する
 */
export async function getOrCreateUser(input: CreateUserInput): Promise<User> {
	const docRef = getUsersCollection().doc(input.accountId);
	const doc = await docRef.get();

	if (doc.exists) {
		return doc.data() as User;
	}

	const now = Timestamp.now();
	const user: User = {
		accountId: input.accountId,
		platform: input.platform,
		totalQuizzes: 0,
		correctCount: 0,
		createdAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		updatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	await docRef.set(user);
	logger.info("User created", { accountId: input.accountId });

	return user;
}

/**
 * ユーザー統計を更新する
 */
export async function updateUserStats(
	accountId: string,
	isCorrect: boolean,
): Promise<void> {
	const docRef = getUsersCollection().doc(accountId);
	const now = Timestamp.now();

	const updateData: Record<string, unknown> = {
		totalQuizzes: FieldValue.increment(1),
		updatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	if (isCorrect) {
		updateData.correctCount = FieldValue.increment(1);
	}

	await docRef.update(updateData);
	logger.info("User stats updated", { accountId, isCorrect });
}

// =============================================================================
// T020: クイズ操作メソッド
// =============================================================================

/**
 * クイズを作成する
 */
export async function createQuiz(input: CreateQuizInput): Promise<Quiz> {
	const quizId = uuidv4();
	const now = Timestamp.now();

	const quiz: Quiz = {
		quizId,
		mergeRequestId: input.mergeRequestId,
		accountId: input.accountId,
		questionText: input.generatedQuiz.questionText,
		category: input.generatedQuiz.category,
		difficulty: input.generatedQuiz.difficulty,
		options: input.generatedQuiz.options,
		correctAnswerIndex: input.generatedQuiz.correctAnswerIndex,
		explanation: input.generatedQuiz.explanation,
		diffReference: input.generatedQuiz.diffReference,
		status: "pending",
		createdAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	await getQuizzesCollection().doc(quizId).set(quiz);
	logger.info("Quiz created", { quizId, mergeRequestId: input.mergeRequestId });

	return quiz;
}

/**
 * クイズを取得する
 */
export async function getQuiz(quizId: string): Promise<Quiz | null> {
	const doc = await getQuizzesCollection().doc(quizId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as Quiz;
}

/**
 * クイズステータスを更新する
 */
export async function updateQuizStatus(
	quizId: string,
	status: QuizStatus,
): Promise<void> {
	await getQuizzesCollection().doc(quizId).update({ status });
	logger.info("Quiz status updated", { quizId, status });
}

// =============================================================================
// T021: 回答操作メソッド
// =============================================================================

/**
 * 回答を作成する
 */
export async function createAnswer(
	input: CreateAnswerInput,
	quiz: Quiz,
): Promise<Answer> {
	const answerId = uuidv4();
	const now = Timestamp.now();

	const isCorrect = input.selectedAnswerIndex === quiz.correctAnswerIndex;

	const answer: Answer = {
		answerId,
		quizId: input.quizId,
		accountId: input.accountId,
		mergeRequestId: quiz.mergeRequestId,
		selectedAnswerIndex: input.selectedAnswerIndex,
		isCorrect,
		category: quiz.category,
		difficulty: quiz.difficulty,
		answeredAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	await getAnswersCollection().doc(answerId).set(answer);
	logger.info("Answer created", { answerId, quizId: input.quizId, isCorrect });

	return answer;
}

/**
 * ユーザーの回答履歴を取得する
 */
export async function getAnswersByUser(accountId: string): Promise<Answer[]> {
	const snapshot = await getAnswersCollection()
		.where("accountId", "==", accountId)
		.orderBy("answeredAt", "desc")
		.get();

	return snapshot.docs.map((doc) => doc.data() as Answer);
}

// =============================================================================
// T022: マージリクエスト操作メソッド
// =============================================================================

/**
 * マージリクエストIDを生成する
 * Firestoreのドキュメントパスで使用できる形式にエンコード
 * 形式: {platform}_{owner}_{repo}_{number}
 */
export function generateMergeRequestId(
	platform: Platform,
	owner: string,
	repo: string,
	number: number,
): string {
	return `${platform}_${owner}_${repo}_${number}`;
}

/**
 * マージリクエストを作成する
 */
export async function createMergeRequest(
	input: CreateMergeRequestInput,
): Promise<MergeRequest> {
	const mergeRequestId = generateMergeRequestId(
		input.platform,
		input.owner,
		input.repo,
		input.number,
	);
	const now = Timestamp.now();

	const mergeRequest: MergeRequest = {
		mergeRequestId,
		platform: input.platform,
		owner: input.owner,
		repo: input.repo,
		number: input.number,
		authorAccountId: input.authorAccountId,
		title: input.title,
		diffSummary: input.diffSummary,
		filesChanged: input.filesChanged,
		status: "open",
		createdAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	await getMergeRequestsCollection().doc(mergeRequestId).set(mergeRequest);
	logger.info("MergeRequest created", { mergeRequestId });

	return mergeRequest;
}

/**
 * マージリクエストを取得する
 */
export async function getMergeRequest(
	mergeRequestId: string,
): Promise<MergeRequest | null> {
	const doc = await getMergeRequestsCollection().doc(mergeRequestId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as MergeRequest;
}

// =============================================================================
// ユーザープロファイル操作メソッド
// =============================================================================

/**
 * ユーザープロファイルを作成または更新する
 */
export async function upsertUserProfile(
	input: import("../types/entities/userProfile.js").CreateUserProfileInput,
): Promise<import("../types/entities/userProfile.js").UserProfile> {
	const docRef = getUserProfilesCollection().doc(input.accountId);
	const doc = await docRef.get();
	const now = Timestamp.now();

	if (doc.exists) {
		// 既存のプロファイルを更新
		const updateData = {
			...(input.careerGoal !== undefined && { careerGoal: input.careerGoal }),
			...(input.experienceLevel !== undefined && {
				experienceLevel: input.experienceLevel,
			}),
			...(input.yearsOfExperience !== undefined && {
				yearsOfExperience: input.yearsOfExperience,
			}),
			...(input.focusAreas !== undefined && { focusAreas: input.focusAreas }),
			...(input.selfAssessment !== undefined && {
				selfAssessment: input.selfAssessment,
			}),
			updatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		};

		await docRef.update(updateData);
		logger.info("UserProfile updated", { accountId: input.accountId });

		const updatedDoc = await docRef.get();
		return updatedDoc.data() as import("../types/entities/userProfile.js").UserProfile;
	}

	// 新規作成
	const profile: import("../types/entities/userProfile.js").UserProfile = {
		accountId: input.accountId,
		careerGoal: input.careerGoal,
		experienceLevel: input.experienceLevel,
		yearsOfExperience: input.yearsOfExperience,
		focusAreas: input.focusAreas || [],
		selfAssessment: input.selfAssessment,
		createdAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		updatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
	};

	await docRef.set(profile);
	logger.info("UserProfile created", { accountId: input.accountId });

	return profile;
}

/**
 * ユーザープロファイルを取得する
 */
export async function getUserProfile(
	accountId: string,
): Promise<import("../types/entities/userProfile.js").UserProfile | null> {
	const doc = await getUserProfilesCollection().doc(accountId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as import("../types/entities/userProfile.js").UserProfile;
}

// =============================================================================
// スキル統計操作メソッド
// =============================================================================

/**
 * スキル統計IDを生成する
 */
function generateSkillStatsId(accountId: string, category: string): string {
	return `${accountId}_${category}`;
}

/**
 * スキル統計を更新する（回答時に呼ばれる）
 */
export async function updateSkillStats(
	input: import("../types/entities/skillStats.js").UpdateSkillStatsInput,
): Promise<void> {
	const statId = generateSkillStatsId(input.accountId, input.category);
	const docRef = getSkillStatsCollection().doc(statId);
	const doc = await docRef.get();
	const now = Timestamp.now();

	// 難易度を数値化
	const difficultyMap = { easy: 1, medium: 2, hard: 3 };
	const difficultyValue = difficultyMap[input.difficulty];

	if (doc.exists) {
		// 既存の統計を更新
		const existingData =
			doc.data() as import("../types/entities/skillStats.js").SkillStats;
		const newTotalQuizzes = existingData.totalQuizzes + 1;
		const newCorrectCount =
			existingData.correctCount + (input.isCorrect ? 1 : 0);
		const newCorrectRate = newCorrectCount / newTotalQuizzes;

		// 平均難易度の更新（累積平均）
		const newAverageDifficulty =
			(existingData.averageDifficulty * existingData.totalQuizzes +
				difficultyValue) /
			newTotalQuizzes;

		await docRef.update({
			totalQuizzes: newTotalQuizzes,
			correctCount: newCorrectCount,
			correctRate: newCorrectRate,
			averageDifficulty: newAverageDifficulty,
			lastAnsweredAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
			calculatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		});

		logger.info("SkillStats updated", {
			accountId: input.accountId,
			category: input.category,
			correctRate: newCorrectRate,
		});
	} else {
		// 新規作成
		const skillStats: import("../types/entities/skillStats.js").SkillStats = {
			statId,
			accountId: input.accountId,
			category: input.category,
			totalQuizzes: 1,
			correctCount: input.isCorrect ? 1 : 0,
			correctRate: input.isCorrect ? 1 : 0,
			averageDifficulty: difficultyValue,
			lastAnsweredAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
			weeklyTrend: 0,
			monthlyTrend: 0,
			calculatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		};

		await docRef.set(skillStats);
		logger.info("SkillStats created", {
			accountId: input.accountId,
			category: input.category,
		});
	}
}

/**
 * ユーザーの全スキル統計を取得する
 */
export async function getSkillStatsByUser(
	accountId: string,
): Promise<import("../types/entities/skillStats.js").SkillStats[]> {
	const snapshot = await getSkillStatsCollection()
		.where("accountId", "==", accountId)
		.get();

	return snapshot.docs.map(
		(doc) => doc.data() as import("../types/entities/skillStats.js").SkillStats,
	);
}

/**
 * 特定カテゴリのスキル統計を取得する
 */
export async function getSkillStats(
	accountId: string,
	category: string,
): Promise<import("../types/entities/skillStats.js").SkillStats | null> {
	const statId = generateSkillStatsId(accountId, category);
	const doc = await getSkillStatsCollection().doc(statId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as import("../types/entities/skillStats.js").SkillStats;
}

// =============================================================================
// 成長マイルストーン操作メソッド
// =============================================================================

/**
 * 成長マイルストーンを作成する
 */
export async function createGrowthMilestone(
	input: import("../types/entities/growthMilestone.js").CreateGrowthMilestoneInput,
): Promise<import("../types/entities/growthMilestone.js").GrowthMilestone> {
	const milestoneId = uuidv4();
	const now = Timestamp.now();

	const milestone: import("../types/entities/growthMilestone.js").GrowthMilestone =
		{
			milestoneId,
			accountId: input.accountId,
			type: input.type,
			category: input.category,
			achievement: input.achievement,
			metadata: input.metadata,
			achievedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		};

	await getGrowthMilestonesCollection().doc(milestoneId).set(milestone);
	logger.info("GrowthMilestone created", {
		milestoneId,
		accountId: input.accountId,
		type: input.type,
	});

	return milestone;
}

/**
 * ユーザーのマイルストーン履歴を取得する
 */
export async function getGrowthMilestonesByUser(
	accountId: string,
): Promise<import("../types/entities/growthMilestone.js").GrowthMilestone[]> {
	const snapshot = await getGrowthMilestonesCollection()
		.where("accountId", "==", accountId)
		.orderBy("achievedAt", "desc")
		.get();

	return snapshot.docs.map(
		(doc) =>
			doc.data() as import("../types/entities/growthMilestone.js").GrowthMilestone,
	);
}

/**
 * マイルストーン達成チェック（回答後に呼ばれる）
 */
export async function checkAndCreateMilestones(
	accountId: string,
	answer: Answer,
	user: User,
	skillStats: import("../types/entities/skillStats.js").SkillStats | null,
): Promise<void> {
	const milestones: import("../types/entities/growthMilestone.js").CreateGrowthMilestoneInput[] =
		[];

	// 初めての正解
	if (answer.isCorrect && user.correctCount === 1) {
		milestones.push({
			accountId,
			type: "first_correct",
			category: answer.category,
			achievement: "初めてのクイズで正解しました！",
			metadata: { quizId: answer.quizId },
		});
	}

	// カテゴリマスター（正答率80%以上）
	if (
		skillStats &&
		skillStats.correctRate >= 0.8 &&
		skillStats.totalQuizzes >= 5
	) {
		// 既にマイルストーンがあるかチェック
		const existingMilestones = await getGrowthMilestonesCollection()
			.where("accountId", "==", accountId)
			.where("type", "==", "category_master")
			.where("category", "==", answer.category)
			.get();

		if (existingMilestones.empty) {
			milestones.push({
				accountId,
				type: "category_master",
				category: answer.category,
				achievement: `${answer.category}分野で正答率80%達成！`,
				metadata: {
					correctRate: skillStats.correctRate,
					totalQuizzes: skillStats.totalQuizzes,
				},
			});
		}
	}

	// 累計回答マイルストーン（10, 50, 100, 500...）
	const totalMilestones = [10, 50, 100, 500, 1000];
	if (totalMilestones.includes(user.totalQuizzes)) {
		milestones.push({
			accountId,
			type: "total_milestone",
			achievement: `累計${user.totalQuizzes}問に回答しました！`,
			metadata: {
				totalQuizzes: user.totalQuizzes,
				correctRate: user.correctCount / user.totalQuizzes,
			},
		});
	}

	// マイルストーンを作成
	for (const milestone of milestones) {
		await createGrowthMilestone(milestone);
	}
}

// =============================================================================
// チーム分析操作メソッド（バッチ処理用）
// =============================================================================

/**
 * チーム分析データを取得する
 */
export async function getTeamAnalytics(
	query: import("../types/entities/teamAnalytics.js").TeamAnalyticsQuery,
): Promise<import("../types/entities/teamAnalytics.js").TeamAnalytics | null> {
	// analyticsIdを生成
	let analyticsId = `${query.period}`;
	if (query.experienceLevel) {
		analyticsId += `_${query.experienceLevel}`;
	}
	if (query.category) {
		analyticsId += `_${query.category}`;
	}

	const doc = await getTeamAnalyticsCollection().doc(analyticsId).get();

	if (!doc.exists) {
		return null;
	}

	return doc.data() as import("../types/entities/teamAnalytics.js").TeamAnalytics;
}

/**
 * チーム分析データを計算して保存する（バッチ処理用）
 */
export async function calculateAndSaveTeamAnalytics(
	period: string,
	experienceLevel?: string,
	category?: string,
): Promise<import("../types/entities/teamAnalytics.js").TeamAnalytics> {
	// 期間の開始・終了日時を計算
	const [year, month] = period.split("-").map(Number);
	const startDate = new Date(year, month - 1, 1);
	const endDate = new Date(year, month, 0, 23, 59, 59);

	// 該当期間の回答を取得
	let answersQuery = getAnswersCollection()
		.where("answeredAt", ">=", Timestamp.fromDate(startDate))
		.where("answeredAt", "<=", Timestamp.fromDate(endDate));

	if (category) {
		answersQuery = answersQuery.where("category", "==", category);
	}

	const answersSnapshot = await answersQuery.get();
	const answers = answersSnapshot.docs.map((doc) => doc.data() as Answer);

	// ユーザーごとの正答率を計算
	const userStats = new Map<string, { correct: number; total: number }>();
	for (const answer of answers) {
		const stats = userStats.get(answer.accountId) || { correct: 0, total: 0 };
		stats.total += 1;
		if (answer.isCorrect) {
			stats.correct += 1;
		}
		userStats.set(answer.accountId, stats);
	}

	// 経験レベルでフィルタリング（指定がある場合）
	let filteredUsers = Array.from(userStats.keys());
	if (experienceLevel) {
		const profilesSnapshot = await getUserProfilesCollection()
			.where("experienceLevel", "==", experienceLevel)
			.get();
		const profileAccountIds = new Set(
			profilesSnapshot.docs.map((doc) => doc.id),
		);
		filteredUsers = filteredUsers.filter((accountId) =>
			profileAccountIds.has(accountId),
		);
	}

	// 正答率を計算
	const correctRates = filteredUsers
		.map((accountId) => {
			const stats = userStats.get(accountId);
			if (!stats) return 0;
			return stats.correct / stats.total;
		})
		.sort((a, b) => a - b);

	// パーセンタイルを計算
	function getPercentile(arr: number[], percentile: number): number {
		if (arr.length === 0) return 0;
		const index = Math.floor(arr.length * percentile);
		return arr[Math.min(index, arr.length - 1)];
	}

	const avgCorrectRate =
		correctRates.length > 0
			? correctRates.reduce((a, b) => a + b, 0) / correctRates.length
			: 0;

	// analyticsIdを生成
	let analyticsId = period;
	if (experienceLevel) {
		analyticsId += `_${experienceLevel}`;
	}
	if (category) {
		analyticsId += `_${category}`;
	}

	const now = Timestamp.now();
	const teamAnalytics: import("../types/entities/teamAnalytics.js").TeamAnalytics =
		{
			analyticsId,
			period,
			experienceLevel:
				experienceLevel as import("../types/entities/userProfile.js").ExperienceLevel,
			category: category as import("../types/index.js").Category,
			avgCorrectRate,
			totalQuizzes: answers.length,
			activeUsers: filteredUsers.length,
			percentile25: getPercentile(correctRates, 0.25),
			percentile50: getPercentile(correctRates, 0.5),
			percentile75: getPercentile(correctRates, 0.75),
			percentile90: getPercentile(correctRates, 0.9),
			calculatedAt: { seconds: now.seconds, nanoseconds: now.nanoseconds },
		};

	await getTeamAnalyticsCollection().doc(analyticsId).set(teamAnalytics);
	logger.info("TeamAnalytics calculated", {
		analyticsId,
		activeUsers: filteredUsers.length,
		avgCorrectRate,
	});

	return teamAnalytics;
}
