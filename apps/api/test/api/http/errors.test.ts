import request from "supertest";
import { describe, expect, it } from "vitest";

import { createTestApp } from "../../helpers/test-app.js";

const app = createTestApp();
const ID = "6b1f2a7e-2f4b-4c1d-9a8e-1f2e3d4c5b6a";

describe("HTTP error envelope (conventions §6, errors §1)", () => {
  it("unknown route → 404 ROUTE_NOT_FOUND without echoing the query string", async () => {
    const res = await request(app).get("/nope?token=secret123");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "ROUTE_NOT_FOUND", message: "Route GET /nope not found" } });
    expect(JSON.stringify(res.body)).not.toContain("secret123");
  });

  it("AppError → its catalog status, code, and message", async () => {
    const res = await request(app).get("/debug/app-error");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "PROJECT_NOT_FOUND", message: "Project not found" } });
  });

  it("unexpected error → generic 500 that leaks nothing", async () => {
    const res = await request(app).get("/debug/unexpected");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } });
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });

  it("malformed JSON → 400 INVALID_JSON", async () => {
    const res = await request(app).post("/debug/echo").set("Content-Type", "application/json").send('{"a":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("body over 1 MB → 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app).post("/debug/echo").send({ data: "a".repeat(1_100_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("non-JSON body → 415 UNSUPPORTED_MEDIA_TYPE", async () => {
    const res = await request(app).post("/debug/echo").set("Content-Type", "text/plain").send("name=acme");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("request without a body is not rejected as 415", async () => {
    const res = await request(app).post("/debug/echo");

    expect(res.status).toBe(200);
  });
});

describe("Validation details (errors §1)", () => {
  it("reports params, query, and body issues together with prefixed paths", async () => {
    const res = await request(app).post("/debug/validate/not-a-uuid?limit=500").send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    const paths = res.body.error.details.fields.map((f: { path: unknown[] }) => f.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["params.id", "query.limit", "name"]));
  });

  it("rejects unknown body fields (mass assignment)", async () => {
    const res = await request(app).post(`/debug/validate/${ID}`).send({ name: "ok", role: "OWNER" });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "unrecognized_keys" })]),
    );
  });

  it("returns parsed values when valid", async () => {
    const res = await request(app).post(`/debug/validate/${ID}?limit=5`).send({ name: "ok" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ params: { id: ID }, query: { limit: 5 }, body: { name: "ok" } });
  });
});

describe("X-Request-Id (conventions §6)", () => {
  it("generates a UUID when the client sends none", async () => {
    const res = await request(app).get("/healthz");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses a well-formed client value", async () => {
    const res = await request(app).get("/healthz").set("X-Request-Id", "client-abc_123");

    expect(res.headers["x-request-id"]).toBe("client-abc_123");
  });

  it("replaces a malformed client value", async () => {
    const res = await request(app).get("/healthz").set("X-Request-Id", "bad value<script>");

    expect(res.headers["x-request-id"]).not.toBe("bad value<script>");
  });

  it("is present on error responses too", async () => {
    const res = await request(app).get("/debug/unexpected");

    expect(res.headers["x-request-id"]).toBeDefined();
  });
});
