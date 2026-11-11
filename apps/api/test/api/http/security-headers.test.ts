import { describe, expect, it } from "vitest";
import request from "supertest";

import { createTestApp } from "../../helpers/test-app.js";
import { createSecurityHeaders } from "../../../src/http/security-headers.js";

describe("Security Headers", () => {
  it("should return Helmet security headers", async () => {
    const response = await request(createTestApp()).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should not enable HSTS in development", async () => {
    const app = createTestApp();

    const response = await request(app).get("/healthz");

    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("should enable HSTS in production", async () => {
    const express = await import("express");
    const app = express.default();

    app.use(createSecurityHeaders("production"));
    app.get("/healthz", (_req, res) => res.sendStatus(200));

    const response = await request(app).get("/healthz");

    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
