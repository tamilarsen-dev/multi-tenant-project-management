// multi-tenant-project-management/apps/api/src/middleware/api-docs.ts

import { apiReference } from "@scalar/express-api-reference";
import express, { Router } from "express";
import { fileURLToPath } from "node:url";

import type { RequestHandler } from "express";
import type { SecurityResponse } from "./security-headers.js";

const router = Router();

const openApiDir = fileURLToPath(
  new URL("../../docs/openapi/", import.meta.url),
);

// Serve OpenAPI specification and external references.
router.use(express.static(openApiDir, { index: false }));

// Scalar API Reference.
router.use((req, res, next) => {
  const nonce = (res as SecurityResponse).locals.cspNonce;

  const handler = apiReference({
    url: "/docs/openapi-bundled.yaml",

    // Appearance
    theme: "purple",
    layout: "modern",
    darkMode: true,
    withDefaultFonts: true,

    // Navigation
    showSidebar: true,
    showDeveloperTools: "localhost",
    searchHotKey: "k",
    operationTitleSource: "summary",
    defaultOpenFirstTag: true,
    defaultOpenAllTags: false,

    // API interaction
    hideClientButton: false,
    hideTestRequestButton: false,
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },

    // Operation details
    showOperationId: true,
    expandAllParameters: true,
    expandAllResponses: false,
    maxVisibleRequestBodyProperties: 12,

    // Models and schemas
    hideModels: false,
    hideModelNames: false,
    modelsSectionLabel: "Models",
    expandAllModelSections: false,
    expandAllSchemaProperties: false,
    orderRequiredPropertiesFirst: true,
    orderSchemaPropertiesBy: "preserve",

    // Document download
    documentDownloadType: "none",

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
