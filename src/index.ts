import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { commentRoutes } from "./routes/comment.js";
import { quizRoutes } from "./routes/quiz.js";
import { userRoutes } from "./routes/user.js";
import webhookRoutes from "./routes/webhook.js";
import { logger } from "./utils/logger.js";

// T009: Honoアプリケーションのエントリーポイント

const app = new Hono();

// グローバルエラーハンドラー
app.onError(errorHandler);

// レートリミット（T014-1）
app.use(rateLimitMiddleware);

// ヘルスチェックエンドポイント
app.get("/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ルートエンドポイント
app.get("/", (c) => {
	return c.json({
		name: "MR/PR Quiz Bot",
		version: "0.1.0",
		endpoints: {
			health: "GET /health",
			generateQuiz: "POST /api/quiz/generate",
			answerQuiz: "POST /api/quiz/:quizId/answer",
			githubWebhook: "POST /api/webhook/github",
			gitlabWebhook: "POST /api/webhook/gitlab",
			userProfile: "PUT /api/users/:accountId/profile",
			getUserProfile: "GET /api/users/:accountId/profile",
			userSkills: "GET /api/users/:accountId/skills",
			userGrowth: "GET /api/users/:accountId/growth",
			userRecommendations: "GET /api/users/:accountId/recommendations",
			teamAnalytics: "GET /api/analytics/team?period=YYYY-MM",
			benchmarks: "GET /api/analytics/benchmarks?period=YYYY-MM",
		},
	});
});

// APIルート
app.route("/api/webhook", webhookRoutes);
app.route("/api/comment", commentRoutes);
app.route("/api/quiz", quizRoutes);
app.route("/api/users", userRoutes);
app.route("/api/analytics", analyticsRoutes);

// サーバー起動
const port = env.PORT;

logger.info("Starting server", { port });

serve({
	fetch: app.fetch,
	port,
});

logger.info("Server started", { port });

export default app;
