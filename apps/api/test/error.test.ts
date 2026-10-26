import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("API error handling", () => {
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
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          fields: [
            {
              field: "email",
              code: "INVALID_FORMAT",
            },
          ],
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
});
