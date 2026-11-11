import { apiReference } from "@scalar/express-api-reference";
import { Router } from "express";
import { fileURLToPath } from "node:url";

import type { RequestHandler } from "express";
import type { SecurityResponse } from "./security-headers.js";

import { env } from "../config/env.js";

const router = Router();

const bundledSpecPath = fileURLToPath(
  new URL("../../docs/openapi/openapi-bundled.yaml", import.meta.url),
);

router.get("/openapi-bundled.yaml", (_req, res, next) => {
  res.sendFile(bundledSpecPath, (error) => {
    if (error) next(error);
  });
});

// Scalar API Reference.
router.use((req, res, next) => {
  const nonce = (res as SecurityResponse).locals.cspNonce;

  const isProduction = env.NODE_ENV === "production";

  const handler = apiReference({
    url: "/docs/openapi-bundled.yaml",

    // Appearance
    theme: "purple",
    layout: "modern",
    darkMode: true,
    withDefaultFonts: true,

    // Navigation
    showSidebar: true,
    showDeveloperTools: isProduction ? "never" : "localhost",
    searchHotKey: "k",
    operationTitleSource: "summary",
    defaultOpenFirstTag: true,
    defaultOpenAllTags: false,

    // API interaction
    hideClientButton: false,
    hideTestRequestButton: isProduction,
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },

    // Client Libraries
    featuredClients: ["shell/curl", "node/fetch", "python/requests"],

    // Operation details
    showOperationId: true,
    expandAllParameters: true,
    expandAllResponses: false,
    maxVisibleRequestBodyProperties: 12,

    // Models and schemas
    hideModels: false,
    hideModelNames: false,
    modelsSectionLabel: "Schemas",
    expandAllModelSections: false,
    expandAllSchemaProperties: false,
    orderRequiredPropertiesFirst: true,
    orderSchemaPropertiesBy: "preserve",

    // Document download
    documentDownloadType: "both",

    // Security
    nonce,
    persistAuth: false,

    // Privacy
    telemetry: false,
  });

  const scalarHandler: RequestHandler = (request, response, callback) => {
    handler(request as never, response as never, callback);
  };

  scalarHandler(req, res, next);
});

export { router as apiDocs };
