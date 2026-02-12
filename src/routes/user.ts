import { Hono } from "hono";
import { NotFoundError, ValidationError } from "../middleware/error.js";
import {
	getGrowthMilestonesByUser,
	getSkillStatsByUser,
	getUserProfile,
	upsertUserProfile,
} from "../services/firestore.js";
import { generateLearningRecommendations } from "../services/personalization.js";
import { CreateUserProfileInputSchema } from "../types/entities/userProfile.js";
import { logger } from "../utils/logger.js";

// ユーザープロファイル・スキル分析APIエンドポイント

const userRoutes = new Hono();

// =============================================================================
// ユーザープロファイル管理
// =============================================================================

/** プロファイル作成・更新API */
userRoutes.put("/:accountId/profile", async (c) => {
	const accountId = c.req.param("accountId");
	const body = await c.req.json();

	// バリデーション（作成と更新を区別）
	const parseResult = CreateUserProfileInputSchema.safeParse({
		...body,
		accountId,
	});

	if (!parseResult.success) {
		throw new ValidationError(
			"Invalid profile data",
			parseResult.error.flatten(),
		);
	}

	const input = parseResult.data;

	logger.info("User profile update requested", { accountId });

	const profile = await upsertUserProfile(input);

	logger.info("User profile updated", { accountId });

	return c.json(profile);
});

/** プロファイル取得API */
userRoutes.get("/:accountId/profile", async (c) => {
	const accountId = c.req.param("accountId");

	logger.info("User profile fetch requested", { accountId });

	const profile = await getUserProfile(accountId);

	if (!profile) {
		throw new NotFoundError("User profile");
	}

	return c.json(profile);
});

// =============================================================================
// スキル分析
// =============================================================================

/** スキル統計取得API */
userRoutes.get("/:accountId/skills", async (c) => {
	const accountId = c.req.param("accountId");

	logger.info("User skills fetch requested", { accountId });

	const skills = await getSkillStatsByUser(accountId);

	// 弱点分野（正答率の低い順）を計算
	const weakAreas = [...skills]
		.filter((s) => s.totalQuizzes >= 3) // 最低3問以上回答している分野のみ
		.sort((a, b) => a.correctRate - b.correctRate)
		.slice(0, 5);

	// 強み分野（正答率の高い順）を計算
	const strongAreas = [...skills]
		.filter((s) => s.totalQuizzes >= 3)
		.sort((a, b) => b.correctRate - a.correctRate)
		.slice(0, 5);

	return c.json({
		skills,
		weakAreas,
		strongAreas,
	});
});

// =============================================================================
// 成長履歴
// =============================================================================

/** 成長マイルストーン取得API */
userRoutes.get("/:accountId/growth", async (c) => {
	const accountId = c.req.param("accountId");

	logger.info("User growth milestones fetch requested", { accountId });

	const milestones = await getGrowthMilestonesByUser(accountId);

	return c.json({
		milestones,
		totalMilestones: milestones.length,
	});
});

// =============================================================================
// 学習推奨
// =============================================================================

/** 学習推奨事項取得API */
userRoutes.get("/:accountId/recommendations", async (c) => {
	const accountId = c.req.param("accountId");

	logger.info("Learning recommendations fetch requested", { accountId });

	const profile = await getUserProfile(accountId);
	const skills = await getSkillStatsByUser(accountId);

	const recommendations = generateLearningRecommendations(profile, skills);

	return c.json(recommendations);
});

export { userRoutes };
