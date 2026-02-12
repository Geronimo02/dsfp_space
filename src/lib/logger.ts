import * as Sentry from "@sentry/react";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
};

const writeLog = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  const logger = level === "debug" ? console.debug : console[level];
  logger(JSON.stringify(payload));

  if (level === "error") {
    const error = context?.error;
    if (error) {
      Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
    } else {
      Sentry.captureMessage(message, "error");
    }
  }
};

export const logger = {
  debug: (message: string, context?: LogContext) => writeLog("debug", message, context),
  info: (message: string, context?: LogContext) => writeLog("info", message, context),
  warn: (message: string, context?: LogContext) => writeLog("warn", message, context),
  error: (message: string, context?: LogContext) =>
    writeLog("error", message, context && { ...context, error: serializeError(context.error) }),
};
