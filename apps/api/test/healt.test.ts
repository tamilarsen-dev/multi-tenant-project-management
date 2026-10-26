import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
