import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createSession, createUser } from "../../factories/index.js";
import { resetDatabase } from "../../helpers/database.js";

const ME = "/api/v1/auth/me";
const HOUR = 60 * 60 * 1000;

describe("Authentication and GET /api/v1/auth/me (contract §3.5)", () => {
  beforeEach(resetDatabase);

  it("valid session → 200 with the user and no secrets", async () => {
    const user = await createUser({ email: "carol@example.com", displayName: "Carol" });
    const { token } = await createSession(user.id);

    const res = await request(app).get(ME).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { user: { id: user.id, email: "carol@example.com", displayName: "Carol", createdAt: expect.any(String) } },
    });
  });

  it.each([
    ["no header", undefined],
    ["wrong scheme", "Basic abc"],
    ["empty bearer", "Bearer "],
  ])("%s → 401 MISSING_AUTHENTICATION with WWW-Authenticate", async (_name, header) => {
    const req = request(app).get(ME);
    const res = await (header === undefined ? req : req.set("Authorization", header));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_AUTHENTICATION");
    expect(res.headers["www-authenticate"]).toBe("Bearer");
  });

  it("unknown token → 401 INVALID_SESSION", async () => {
    const res = await request(app).get(ME).set("Authorization", "Bearer deadbeef");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SESSION");
  });

  it("expired session → 401 INVALID_SESSION", async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, {
      createdAt: new Date(Date.now() - 8 * 24 * HOUR),
      expiresAt: new Date(Date.now() - HOUR),
    });

    const res = await request(app).get(ME).set("Authorization", `Bearer ${token}`);

    expect(res.body.error.code).toBe("INVALID_SESSION");
  });

  it("revoked session → 401 INVALID_SESSION", async () => {
    const user = await createUser();
    const { token } = await createSession(user.id, { revokedAt: new Date() });

    const res = await request(app).get(ME).set("Authorization", `Bearer ${token}`);

    expect(res.body.error.code).toBe("INVALID_SESSION");
  });
});

describe("POST /api/v1/auth/logout (contract §3.4)", () => {
  beforeEach(resetDatabase);

  it("revokes only the calling session", async () => {
    const user = await createUser();
    const current = await createSession(user.id);
    const other = await createSession(user.id);

    const res = await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${current.token}`);

    expect(res.status).toBe(204);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: current.session.id } })).revokedAt).not.toBeNull();
    expect((await prisma.session.findUniqueOrThrow({ where: { id: other.session.id } })).revokedAt).toBeNull();

    const reuse = await request(app).get(ME).set("Authorization", `Bearer ${current.token}`);
    expect(reuse.body.error.code).toBe("INVALID_SESSION");
  });

  it("without authentication → 401", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(401);
  });
});
