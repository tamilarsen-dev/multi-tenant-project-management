import express from "express";
import type { Options } from "express-rate-limit";
import { z } from "zod";

import { corsPolicy } from "../../src/http/cors.js";
import { errorHandler, notFoundHandler, requireJsonBody } from "../../src/http/error-handler.js";
import { AppError } from "../../src/http/errors.js";
import { createRateLimiter } from "../../src/http/rate-limiter.js";
import { requestLogger } from "../../src/http/request-logger.js";
import { securityHeaders } from "../../src/http/security-headers.js";
import { parseRequest } from "../../src/http/validate.js";

/**
 * The production middleware stack plus debug routes that trigger specific failures,
 * for testing cross-cutting HTTP behavior in isolation.
 */
export function createTestApp(rateLimitOptions: Partial<Options> = {}, trustProxy?: string) {
  const app = express();
  if (trustProxy) app.set("trust proxy", trustProxy);

  app.disable("x-powered-by");
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(createRateLimiter(rateLimitOptions));
  app.use(requireJsonBody);
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.post("/debug/echo", (req, res) => {
    res.json({ data: req.body });
  });

  app.get("/debug/app-error", () => {
    throw new AppError("PROJECT_NOT_FOUND");
  });

  app.get("/debug/unexpected", () => {
    throw new Error("Database password leaked: hunter2");
  });

  app.post("/debug/validate/:id", (req, res) => {
    const input = parseRequest(req, {
      params: z.strictObject({ id: z.uuid() }),
      query: z.strictObject({ limit: z.coerce.number().int().max(100).optional() }),
      body: z.strictObject({ name: z.string().min(1) }),
    });
    res.json({ data: input });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
