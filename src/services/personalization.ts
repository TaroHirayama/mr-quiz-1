import type { SkillStats } from "../types/entities/skillStats.js";
import type { UserProfile } from "../types/entities/userProfile.js";
import type { Category, Difficulty } from "../types/index.js";
import { logger } from "../utils/logger.js";

/**
 * パーソナライズ出題サービス
 * ユーザーのスキルマップとプロファイルに基づいて最適なクイズカテゴリと難易度を選択
 */

/**
 * ユーザーに最適なクイズカテゴリを選択する
 */
export function selectOptimalCategory(
	profile: UserProfile | null,
	skillStats: SkillStats[],
): Category {
	const allCategories: Category[] = [
		"bug_fix",
		"performance",
		"refactoring",
		"security",
		"logic",
	];

	// プロファイルがない場合はランダム選択
	if (!profile || skillStats.length === 0) {
		return allCategories[Math.floor(Math.random() * allCategories.length)];
	}

	// 各カテゴリの優先度スコアを計算
	const categoryScores = allCategories.map((category) => {
		const score = calculateCategoryPriority(profile, skillStats, category);
		return { category, score };
	});

	// スコアでソート
	categoryScores.sort((a, b) => b.score - a.score);

	// 上位3つからランダム選択（完全固定を避ける）
	const topCategories = categoryScores.slice(0, 3);
	const selectedIndex = Math.floor(Math.random() * topCategories.length);

	const selected = topCategories[selectedIndex].category;

	logger.info("Category selected", {
		selected,
		scores: categoryScores,
	});

	return selected;
}

/**
 * カテゴリの優先度スコアを計算
 */
function calculateCategoryPriority(
	profile: UserProfile,
	skillStats: SkillStats[],
	category: Category,
): number {
	let score = 0;

	// 1. 苦手度（重み: 40%）
	const categoryStats = skillStats.find((s) => s.category === category);
	if (categoryStats && categoryStats.totalQuizzes >= 3) {
		// 最低3問以上回答している場合のみ
		const weaknessScore = 1 - categoryStats.correctRate; // 正答率が低いほど高スコア
		score += weaknessScore * 0.4;
	} else {
		// データが少ない場合は中程度の優先度
		score += 0.2;
	}

	// 2. 目標関連度（重み: 30%）
	if (profile.focusAreas?.includes(category)) {
		score += 0.3;
	}

	// 3. 復習タイミング（重み: 20%）
	if (categoryStats?.lastAnsweredAt) {
		const daysSinceLastQuiz = getDaysSince(categoryStats.lastAnsweredAt);
		if (daysSinceLastQuiz >= 7) {
			// 1週間以上経過で復習推奨
			score += 0.2;
		} else if (daysSinceLastQuiz >= 3) {
			// 3日以上経過
			score += 0.1;
		}
	} else {
		// まだ回答していない分野は高優先度
		score += 0.15;
	}

	// 4. 成長機会（重み: 10%）
	// 平均難易度が低い分野は成長の余地あり
	if (categoryStats && categoryStats.averageDifficulty < 2) {
		score += 0.1;
	}

	return score;
}

/**
 * ユーザーに最適な難易度を選択する
 */
export function selectOptimalDifficulty(
	profile: UserProfile | null,
	categoryStats: SkillStats | null,
): Difficulty {
	// プロファイルがない場合は経験レベルに基づく
	if (!profile) {
		return "easy";
	}

	// 経験レベルによる基本難易度
	let baseDifficulty: Difficulty;
	switch (profile.experienceLevel) {
		case "junior":
			baseDifficulty = "easy";
			break;
		case "mid":
			baseDifficulty = "medium";
			break;
		case "senior":
			baseDifficulty = "hard";
			break;
		default:
			baseDifficulty = "medium";
	}

	// カテゴリ統計に基づく調整
	if (categoryStats && categoryStats.totalQuizzes >= 5) {
		if (categoryStats.correctRate >= 0.8) {
			// 正答率80%以上 → 難易度を上げる
			return increaseDifficulty(baseDifficulty);
		}
		if (categoryStats.correctRate <= 0.4) {
			// 正答率40%以下 → 難易度を下げる
			return decreaseDifficulty(baseDifficulty);
		}
	}

	return baseDifficulty;
}

/**
 * 難易度を1段階上げる
 */
function increaseDifficulty(current: Difficulty): Difficulty {
	switch (current) {
		case "easy":
			return "medium";
		case "medium":
			return "hard";
		case "hard":
			return "hard";
	}
}

/**
 * 難易度を1段階下げる
 */
function decreaseDifficulty(current: Difficulty): Difficulty {
	switch (current) {
		case "easy":
			return "easy";
		case "medium":
			return "easy";
		case "hard":
			return "medium";
	}
}

/**
 * 最終回答からの経過日数を計算
 */
function getDaysSince(timestamp: {
	seconds: number;
	nanoseconds: number;
}): number {
	const lastDate = new Date(timestamp.seconds * 1000);
	const now = new Date();
	const diffMs = now.getTime() - lastDate.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * ユーザーの学習推奨事項を生成
 */
export function generateLearningRecommendations(
	profile: UserProfile | null,
	skillStats: SkillStats[],
): {
	weakAreas: Array<{
		category: Category;
		correctRate: number;
		priority: string;
	}>;
	suggestedFocusAreas: Category[];
	nextSteps: string[];
} {
	const recommendations = {
		weakAreas: [] as Array<{
			category: Category;
			correctRate: number;
			priority: string;
		}>,
		suggestedFocusAreas: [] as Category[],
		nextSteps: [] as string[],
	};

	if (skillStats.length === 0) {
		recommendations.nextSteps.push(
			"まずはクイズに挑戦してスキルデータを蓄積しましょう",
		);
		return recommendations;
	}

	// 弱点分野を特定（正答率60%未満）
	const weakStats = skillStats
		.filter((s) => s.totalQuizzes >= 3 && s.correctRate < 0.6)
		.sort((a, b) => a.correctRate - b.correctRate);

	for (const stat of weakStats) {
		let priority = "low";
		if (stat.correctRate < 0.3) priority = "high";
		else if (stat.correctRate < 0.5) priority = "medium";

		recommendations.weakAreas.push({
			category: stat.category,
			correctRate: stat.correctRate,
			priority,
		});
	}

	// 注力分野の提案
	if (profile?.focusAreas && profile.focusAreas.length > 0) {
		recommendations.suggestedFocusAreas = profile.focusAreas;
	} else if (recommendations.weakAreas.length > 0) {
		// 最も弱い分野を提案
		recommendations.suggestedFocusAreas = [
			recommendations.weakAreas[0].category,
		];
	}

	// 次のステップ提案
	if (weakStats.length > 0) {
		recommendations.nextSteps.push(
			`${weakStats[0].category}分野の理解を深めましょう（現在の正答率: ${Math.round(weakStats[0].correctRate * 100)}%）`,
		);
	}

	const masteredAreas = skillStats.filter(
		(s) => s.totalQuizzes >= 5 && s.correctRate >= 0.8,
	);
	if (masteredAreas.length > 0) {
		recommendations.nextSteps.push(
			`${masteredAreas[0].category}分野は習得済みです！より高度な問題に挑戦しましょう`,
		);
	}

	if (profile && profile.experienceLevel === "junior") {
		const totalQuizzes = skillStats.reduce((sum, s) => sum + s.totalQuizzes, 0);
		if (totalQuizzes >= 50) {
			recommendations.nextSteps.push(
				"50問達成！次はmidレベルの問題に挑戦してみましょう",
			);
		}
	}

	return recommendations;
}
