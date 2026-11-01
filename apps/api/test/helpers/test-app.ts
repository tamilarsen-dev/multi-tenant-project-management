import express from "express";

import { AppError } from "../../src/errors/app-error.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { notFoundHandler } from "../../src/middleware/not-found.js";
import { requestLogger } from "../../src/middleware/request-logger.js";
import { z } from "zod";

export function createTestApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  app.get("/debug-not-found", () => {
    throw new AppError("NOT_FOUND", {
      message: "Project not found",
    });
  });

  app.get("/debug-validation", () => {
    z.email().parse("invalid-email");
  });

  app.post("/debug-json", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/debug-slow", async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    res.json({ status: "completed" });
  });

  app.get("/debug-unknown-error", () => {
    throw new Error("Database password leaked");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
