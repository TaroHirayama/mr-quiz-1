import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "../utils/logger.js";

// T013: エラーハンドリングミドルウェア

export class AppError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = "AppError";
	}
}

export class ValidationError extends AppError {
	constructor(
		message: string,
		public readonly details?: unknown,
	) {
		super(400, message, "VALIDATION_ERROR");
		this.name = "ValidationError";
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super(404, `${resource} not found`, "NOT_FOUND");
		this.name = "NotFoundError";
	}
}

interface ErrorResponse {
	error: {
		message: string;
		code?: string;
		details?: unknown;
	};
}

/**
 * Honoのグローバルエラーハンドラー
 * app.onError(errorHandler) として使用
 */
export const errorHandler: ErrorHandler = (err, c) => {
	if (err instanceof AppError) {
		logger.warn("Application error", {
			statusCode: err.statusCode,
			code: err.code,
			message: err.message,
		});

		const response: ErrorResponse = {
			error: {
				message: err.message,
				code: err.code,
			},
		};

		if (err instanceof ValidationError && err.details) {
			response.error.details = err.details;
		}

		return c.json(response, err.statusCode as 400 | 404 | 500);
	}

	if (err instanceof HTTPException) {
		logger.warn("HTTP exception", {
			statusCode: err.status,
			message: err.message,
		});

		return c.json(
			{ error: { message: err.message } },
			err.status as 400 | 404 | 500,
		);
	}

	const message = err instanceof Error ? err.message : "Unknown error";
	logger.error("Unhandled error", {
		error: message,
		stack: err instanceof Error ? err.stack : undefined,
	});

	return c.json(
		{ error: { message: "Internal server error", code: "INTERNAL_ERROR" } },
		500,
	);
};
