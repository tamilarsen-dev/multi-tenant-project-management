import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";
import { logger } from "../config/logger.js";

function isMalformedJsonError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.parse.failed"
  );
}

function isPayloadTooLargeError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.too.large"
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (isMalformedJsonError(err)) {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  }

  if (isPayloadTooLargeError(err)) {
    return res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the allowed size",
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          fields: err.issues.map((issue) => ({
            path: issue.path.map(String),
            code: issue.code,
            message: issue.message,
          })),
        },
      },
    });
  }

  if (err instanceof AppError) {
    const logMethod = err.statusCode >= 500 ? "error" : "warn";

    logger[logMethod](
      {
        err,
        method: req.method,
        url: req.path,
        statusCode: err.statusCode,
        code: err.code,
      },
      "Application error",
    );

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  logger.error(
    {
      err,
      method: req.method,
      url: req.path,
    },
    "Unexpected error",
  );

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
