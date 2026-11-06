import express from "express";

import {
  securityHeaders,
  createCspNonce,
} from "./middleware/security-headers.js";
import { corsPolicy } from "./middleware/cors.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestLogger } from "./middleware/request-logger.js";
import { apiDocs } from "./middleware/api-docs.js";
import { AppSuccess } from "./common/http/app-success.js";

import authRoutes from "./modules/identity/auth.routes.js";
import organizationRoutes from "./modules/organization/organization.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(createCspNonce);
app.use(securityHeaders);
app.use(corsPolicy);
app.use(requestLogger);
app.use(rateLimiter);
app.use(express.json({ limit: "1mb" }));

// routes

// Health check
app.get("/healthz", (_req, res) => {
  return res.status(200).json(new AppSuccess({ status: "ok" }));
});

// app
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organizations", organizationRoutes);

// API documentation
app.use("/docs", apiDocs);

// Not found & error handler
app.use(notFoundHandler);
app.use(errorHandler);
