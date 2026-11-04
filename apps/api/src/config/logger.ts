import pino, { type LoggerOptions } from "pino";
import { env } from "./env.js";

export const loggerOptions: LoggerOptions = {
  level:
    env.NODE_ENV === "production"
      ? "info"
      : env.NODE_ENV === "test"
        ? "silent"
        : "debug",

  redact: {
    paths: [
      "password",
      "passwordHash",
      "sessionToken",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.passwordHash",
      "*.sessionToken",
      "*.token",
      "*.authorization",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
    ],
    censor: "[REDACTED]",
  },

  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
};

export const logger = pino(loggerOptions);
