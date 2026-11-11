import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("Health endpoints (operations §4)", () => {
  it("GET /healthz → 200 ok", async () => {
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok" } });
  });

  it("GET /readyz → 200 ok when PostgreSQL answers", async () => {
    const res = await request(app).get("/readyz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: "ok" } });
  });
});
