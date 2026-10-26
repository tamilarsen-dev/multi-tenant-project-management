import express from "express";

const app = express();

app.disable("x-powered-by");

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export { app };
