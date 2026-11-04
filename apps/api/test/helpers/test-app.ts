import express from "express";
import { z } from "zod";
import type { Options } from "express-rate-limit";

import { AppError } from "../../src/common/http/app-error.js";
import { securityHeaders } from "../../src/middleware/security-headers.js";
import { corsPolicy } from "../../src/middleware/cors.js";
import { createRateLimiter } from "../../src/middleware/rate-limiter.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { notFoundHandler } from "../../src/middleware/not-found.js";
import { requestLogger } from "../../src/middleware/request-logger.js";

export function createTestApp(rateLimitOptions: Partial<Options> = {}) {
  const app = express();

  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(requestLogger);
  app.use(createRateLimiter(rateLimitOptions));
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.post("/debug-json", (req, res) => {
    res.json({ data: req.body });
  });

  app.get("/debug-not-found", () => {
    throw new AppError("NOT_FOUND", {
      message: "Project not found",
    });
  });

  app.get("/debug-validation", () => {
    z.email().parse("invalid-email");
  });

  app.get("/debug-unknown-error", () => {
    throw new Error("Internal database failure");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
