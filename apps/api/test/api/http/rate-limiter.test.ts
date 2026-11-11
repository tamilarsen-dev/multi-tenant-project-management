import { describe, expect, it } from "vitest";
import request from "supertest";

import { createTestApp } from "../../helpers/test-app.js";

describe("Rate Limiter", () => {
  it("should allow requests within the configured limit", async () => {
    const app = createTestApp({
      windowMs: 60_000,
      limit: 2,
    });

    const first = await request(app).get("/healthz");
    const second = await request(app).get("/healthz");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("should reject requests exceeding the configured limit", async () => {
    const app = createTestApp({
      windowMs: 60_000,
      limit: 2,
    });

    await request(app).get("/healthz");
    await request(app).get("/healthz");

    const third = await request(app).get("/healthz");

    expect(third.status).toBe(429);
  });

  it("should return the expected error envelope", async () => {
    const app = createTestApp({
      windowMs: 60_000,
      limit: 1,
    });

    await request(app).get("/healthz");

    const response = await request(app).get("/healthz");

    expect(response.body).toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests",
      },
    });
  });

  it("should include Retry-After when limit is exceeded", async () => {
    const app = createTestApp({
      windowMs: 60_000,
      limit: 1,
    });

    await request(app).get("/healthz");

    const response = await request(app).get("/healthz");

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBeDefined();
  });

  it("should isolate rate limit counters between instances", async () => {
    const appA = createTestApp({
      windowMs: 60_000,
      limit: 1,
    });

    const appB = createTestApp({
      windowMs: 60_000,
      limit: 1,
    });

    await request(appA).get("/healthz");
    const responseA = await request(appA).get("/healthz");

    const responseB = await request(appB).get("/healthz");

    expect(responseA.status).toBe(429);
    expect(responseB.status).toBe(200);
  });
});
