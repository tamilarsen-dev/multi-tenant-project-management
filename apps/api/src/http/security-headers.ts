import { randomBytes } from "node:crypto";
import type { RequestHandler, Response } from "express";
import helmet from "helmet";

import { env } from "../config/env.js";

export type SecurityResponse = Response & {
  locals: Response["locals"] & {
    cspNonce: string;
  };
};

export const createCspNonce: RequestHandler = (_req, res, next) => {
  (res as SecurityResponse).locals.cspNonce =
    randomBytes(16).toString("base64");

  next();
};

export function createSecurityHeaders(
  nodeEnv: typeof env.NODE_ENV = env.NODE_ENV,
) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: [
          "'self'",
          (_req, res) => `'nonce-${(res as SecurityResponse).locals.cspNonce}'`,
        ],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      },
    },

    strictTransportSecurity:
      nodeEnv === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
          }
        : false,
  });
}

export const securityHeaders = createSecurityHeaders();
