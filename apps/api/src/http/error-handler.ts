import type { ErrorRequestHandler, RequestHandler, Response } from "express";

import { logger } from "../config/logger.js";
import { AppError, ERROR_CATALOG, type ErrorCode, type ErrorDetails } from "./errors.js";

function hasType(err: unknown, type: string): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === type;
}

function send(res: Response, code: ErrorCode, message: string, details?: ErrorDetails) {
  const { status } = ERROR_CATALOG[code];

  if (status === 401) {
    res.setHeader("WWW-Authenticate", "Bearer");
  }

  return res.status(status).json({
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

/** Maps every error to the envelope in docs/design/api/conventions.md §6. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (hasType(err, "entity.parse.failed")) {
    return send(res, "INVALID_JSON", ERROR_CATALOG.INVALID_JSON.message);
  }

  if (hasType(err, "entity.too.large")) {
    return send(res, "PAYLOAD_TOO_LARGE", ERROR_CATALOG.PAYLOAD_TOO_LARGE.message);
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId: req.id, code: err.code }, "Application error");
    }

    return send(res, err.code, err.message, err.details);
  }

  logger.error({ err, requestId: req.id, method: req.method, route: req.path }, "Unexpected error");

  return send(res, "INTERNAL_SERVER_ERROR", ERROR_CATALOG.INTERNAL_SERVER_ERROR.message);
};

/** Unknown route. Never echoes the query string, which may contain secrets. */
export const notFoundHandler: RequestHandler = (req, res) => {
  send(res, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} not found`);
};

/**
 * Rejects bodies that are not JSON with 415 instead of silently ignoring them.
 * A request "has a body" when it declares a non-zero length or chunked transfer.
 */
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  const hasBody =
    req.headers["transfer-encoding"] !== undefined ||
    (req.headers["content-length"] !== undefined && req.headers["content-length"] !== "0");

  if (hasBody && !req.is("application/json")) {
    return next(new AppError("UNSUPPORTED_MEDIA_TYPE"));
  }

  next();
};
