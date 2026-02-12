// T014: ロギングユーティリティ

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

interface Logger {
	debug: (message: string, context?: LogContext) => void;
	info: (message: string, context?: LogContext) => void;
	warn: (message: string, context?: LogContext) => void;
	error: (message: string, context?: LogContext) => void;
}

const logLevelPriority: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel: LogLevel =
	(process.env.LOG_LEVEL as LogLevel) ||
	(process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
	return logLevelPriority[level] >= logLevelPriority[currentLevel];
}

function formatLog(
	level: LogLevel,
	message: string,
	context?: LogContext,
): string {
	const timestamp = new Date().toISOString();
	const base = { timestamp, level, message };
	const logObject = context ? { ...base, ...context } : base;
	return JSON.stringify(logObject);
}

function log(level: LogLevel, message: string, context?: LogContext): void {
	if (!shouldLog(level)) return;

	const output = formatLog(level, message, context);

	switch (level) {
		case "error":
			console.error(output);
			break;
		case "warn":
			console.warn(output);
			break;
		default:
			console.log(output);
	}
}

export const logger: Logger = {
	debug: (message, context) => log("debug", message, context),
	info: (message, context) => log("info", message, context),
	warn: (message, context) => log("warn", message, context),
	error: (message, context) => log("error", message, context),
};
