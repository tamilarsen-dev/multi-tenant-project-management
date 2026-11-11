import express from "express";

import { apiDocs } from "./http/api-docs.js";
import { corsPolicy } from "./http/cors.js";
import { errorHandler, notFoundHandler, requireJsonBody } from "./http/error-handler.js";
import { rateLimiter } from "./http/rate-limiter.js";
import { requestLogger } from "./http/request-logger.js";
import { createCspNonce, securityHeaders } from "./http/security-headers.js";
import healthRoutes from "./modules/health/health.routes.js";
import authRoutes from "./modules/identity/auth.routes.js";
import organizationRoutes from "./modules/organization/organization.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(requestLogger);
app.use(createCspNonce);
app.use(securityHeaders);
app.use(corsPolicy);
app.use(rateLimiter);
app.use(requireJsonBody);
app.use(express.json({ limit: "1mb" }));

app.use(healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/organizations", organizationRoutes);
app.use("/docs", apiDocs);

app.use(notFoundHandler);
app.use(errorHandler);
