import { Hono } from "hono";
import { NotFoundError, ValidationError } from "../middleware/error.js";
import {
	calculateAndSaveTeamAnalytics,
	getTeamAnalytics,
} from "../services/firestore.js";
import { TeamAnalyticsQuerySchema } from "../types/entities/teamAnalytics.js";
import { logger } from "../utils/logger.js";

// チーム分析・アナリティクスAPIエンドポイント

const analyticsRoutes = new Hono();

// =============================================================================
// チーム分析データ取得
// =============================================================================

/** チーム分析取得API */
analyticsRoutes.get("/team", async (c) => {
	const query = c.req.query();

	// バリデーション
	const parseResult = TeamAnalyticsQuerySchema.safeParse(query);

	if (!parseResult.success) {
		throw new ValidationError(
			"Invalid query parameters",
			parseResult.error.flatten(),
		);
	}

	const input = parseResult.data;

	logger.info("Team analytics fetch requested", input);

	const analytics = await getTeamAnalytics(input);

	if (!analytics) {
		throw new NotFoundError(`Team analytics for period ${input.period}`);
	}

	return c.json(analytics);
});

// =============================================================================
// ベンチマークデータ取得
// =============================================================================

/** ベンチマークデータ取得API */
analyticsRoutes.get("/benchmarks", async (c) => {
	const { level, category, period } = c.req.query();

	if (!period) {
		throw new ValidationError("period query parameter is required");
	}

	logger.info("Benchmark data fetch requested", { level, category, period });

	// 全体のベンチマーク
	const overallBenchmark = await getTeamAnalytics({ period });

	// レベル別・カテゴリ別のベンチマーク
	let specificBenchmark = null;
	if (level || category) {
		specificBenchmark = await getTeamAnalytics({
			period,
			experienceLevel: level as "junior" | "mid" | "senior" | undefined,
			category: category as
				| "bug_fix"
				| "performance"
				| "refactoring"
				| "security"
				| "logic"
				| undefined,
		});
	}

	return c.json({
		overall: overallBenchmark,
		specific: specificBenchmark,
	});
});

// =============================================================================
// バッチ処理用（管理者向け）
// =============================================================================

/** チーム分析計算API（バッチ処理用） */
analyticsRoutes.post("/team/calculate", async (c) => {
	const body = await c.req.json();
	const { period, experienceLevel, category } = body;

	if (!period) {
		throw new ValidationError("period is required");
	}

	// 期間形式の検証
	if (!/^\d{4}-\d{2}$/.test(period)) {
		throw new ValidationError("period must be in YYYY-MM format");
	}

	logger.info("Team analytics calculation requested", {
		period,
		experienceLevel,
		category,
	});

	const analytics = await calculateAndSaveTeamAnalytics(
		period,
		experienceLevel,
		category,
	);

	logger.info("Team analytics calculated", {
		analyticsId: analytics.analyticsId,
	});

	return c.json(analytics, 201);
});

export { analyticsRoutes };
