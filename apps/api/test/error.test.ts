import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "./helpers/test-app.js";

describe("API error handling", () => {
  const app = createTestApp();

  it("returns a consistent 404 response", async () => {
    const res = await request(app).get("/this-route-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route GET /this-route-does-not-exist not found",
      },
    });
  });

  it("returns a custom application error", async () => {
    const res = await request(app).get("/debug-not-found");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Project not found",
      },
    });
  });

  it("returns structured validation details", async () => {
    const res = await request(app).get("/debug-validation");

    expect(res.status).toBe(400);

    expect(res.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          fields: expect.arrayContaining([
            expect.objectContaining({
              path: [],
              code: "invalid_format",
              message: expect.any(String),
            }),
          ]),
        },
      },
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/debug-json")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });

  it("returns 413 when request body exceeds the size limit", async () => {
    const largePayload = JSON.stringify({
      data: "a".repeat(110 * 1024),
    });

    const res = await request(app)
      .post("/debug-json")
      .set("Content-Type", "application/json")
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the allowed size",
      },
    });
  });

  it("does not expose query parameters in 404 response", async () => {
    const res = await request(app).get("/unknown-route?token=secret123");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Route GET /unknown-route not found");
    expect(res.body.error.message).not.toContain("secret123");
  });

  it("returns a generic 500 response for unknown errors", async () => {
    const res = await request(app).get("/debug-unknown-error");

    expect(res.status).toBe(500);

    expect(res.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });

    expect(JSON.stringify(res.body)).not.toContain("Database password leaked");
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });
});
