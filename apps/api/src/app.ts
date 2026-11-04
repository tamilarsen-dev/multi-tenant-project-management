import express from "express";

import { securityHeaders } from "./middleware/security-headers.js";
import { corsPolicy } from "./middleware/cors.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestLogger } from "./middleware/request-logger.js";
import { AppSuccess } from "./common/http/app-success.js";

export const app = express();

app.disable("x-powered-by");

app.use(securityHeaders);
app.use(corsPolicy);
app.use(requestLogger);
app.use(rateLimiter);
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  return res.status(200).json(new AppSuccess({ status: "ok" }));
});

// routes

app.use(notFoundHandler);
app.use(errorHandler);
