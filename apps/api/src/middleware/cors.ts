import cors from "cors";

import { env } from "../config/env.js";

export const corsPolicy = cors({
  origin(origin, callback) {
    // Request non-browser seperti curl atau server-to-server.
    if (!origin) {
      return callback(null, true);
    }

    if (env.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },

  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  exposedHeaders: ["Retry-After"],

  maxAge: 600,
});
