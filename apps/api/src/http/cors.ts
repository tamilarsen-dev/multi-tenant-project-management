import cors from "cors";

import { env } from "../config/env.js";

export const corsPolicy = cors({
  origin(origin, callback) {
    // Non-browser clients (curl, server-to-server) send no Origin; CORS does not apply to them.
    if (!origin) {
      return callback(null, true);
    }

    if (env.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },

  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],

  exposedHeaders: ["X-Request-Id", "Retry-After", "RateLimit", "RateLimit-Policy", "Location"],

  maxAge: 600,
});
