import helmet from "helmet";

import { env } from "../config/env.js";

export function createSecurityHeaders(
  nodeEnv: typeof env.NODE_ENV = env.NODE_ENV,
) {
  return helmet({
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
