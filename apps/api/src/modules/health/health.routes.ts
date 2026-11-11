import { Router } from "express";

import { checkDatabase } from "./health.repository.js";

const router = Router();

/** Liveness: the process is up. Never touches dependencies. */
router.get("/healthz", (_req, res) => {
  res.status(200).json({ data: { status: "ok" } });
});

/** Readiness: PostgreSQL answers within one second (docs/engineering/operations.md §4). */
router.get("/readyz", async (_req, res) => {
  const ready = await checkDatabase(1_000);
  res.status(ready ? 200 : 503).json({ data: { status: ready ? "ok" : "unavailable" } });
});

export default router;
