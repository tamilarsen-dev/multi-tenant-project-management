import { rateLimit, type Options } from "express-rate-limit";

export function createRateLimiter(options: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 60,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
      },
    },

    ...options,
  });
}

export const rateLimiter = createRateLimiter();
