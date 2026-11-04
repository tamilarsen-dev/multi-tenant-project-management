import { describe, expect, it } from "vitest";
import request from "supertest";

import { createTestApp } from "../helpers/test-app.js";

describe("CORS Middleware", () => {
  const allowedOrigin = "http://localhost:5173";
  const disallowedOrigin = "https://evil.example";

  it("should allow configured origin", async () => {
    const response = await request(createTestApp())
      .get("/healthz")
      .set("Origin", allowedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
  });

  it("should not allow an unconfigured origin", async () => {
    const response = await request(createTestApp())
      .get("/healthz")
      .set("Origin", disallowedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("should process requests without Origin", async () => {
    const response = await request(createTestApp()).get("/healthz");

    expect(response.status).toBe(200);
  });

  it("should handle preflight requests", async () => {
    const response = await request(createTestApp())
      .options("/healthz")
      .set("Origin", allowedOrigin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);

    expect(response.headers["access-control-allow-methods"]).toContain("POST");

    expect(response.headers["access-control-allow-headers"]).toContain(
      "Authorization",
    );
  });

  it("should expose Retry-After response header", async () => {
    const response = await request(createTestApp())
      .get("/healthz")
      .set("Origin", allowedOrigin);

    expect(response.headers["access-control-expose-headers"]).toContain(
      "Retry-After",
    );
  });
});
