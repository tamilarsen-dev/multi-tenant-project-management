import { describe, expect, it } from "vitest";
import request from "supertest";

import { createTestApp } from "../helpers/test-app.js";

describe("JSON Body Parser", () => {
  it("should accept valid JSON", async () => {
    const payload = { name: "Acme" };

    const response = await request(createTestApp())
      .post("/debug-json")
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: payload,
    });
  });

  it("should reject malformed JSON", async () => {
    const response = await request(createTestApp())
      .post("/debug-json")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });

  it("should reject payload larger than 1 MB", async () => {
    const payload = {
      data: "a".repeat(1_100_000),
    };

    const response = await request(createTestApp())
      .post("/debug-json")
      .send(payload);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the allowed size",
      },
    });
  });
});
