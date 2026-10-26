import express from "express";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestLogger } from "./middleware/request-logger.js";

import { AppError } from "./errors/app-error.js";

export const app = express();

app.disable("x-powered-by");

app.use(requestLogger);
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/debug-not-found", () => {
  throw new AppError("NOT_FOUND", {
    message: "Project not found",
  });
});

app.get("/debug-validation", () => {
  throw new AppError("VALIDATION_ERROR", {
    details: {
      fields: [
        {
          field: "email",
          code: "INVALID_FORMAT",
        },
      ],
    },
  });
});

app.post("/debug-json", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);
