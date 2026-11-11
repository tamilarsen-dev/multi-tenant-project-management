import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createSession, createUser } from "../../factories/index.js";
import { resetDatabase, withFailingInserts } from "../../helpers/database.js";

const URL = "/api/v1/auth/refresh";
const DAY = 24 * 60 * 60 * 1000;

describe("POST /api/v1/auth/refresh (contract §3.3, ADR-0003)", () => {
  beforeEach(resetDatabase);

  it("rotates: old token stops working, new token works, absolute expiry is inherited", async () => {
    const user = await createUser();
    const old = await createSession(user.id);

    const res = await request(app).post(URL).set("Authorization", `Bearer ${old.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.session.accessToken).not.toBe(old.token);
    expect(res.body.data.session.absoluteExpiresAt).toBe(old.session.absoluteExpiresAt.toISOString());

    const withOld = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${old.token}`);
    const withNew = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${res.body.data.session.accessToken}`);

    expect(withOld.status).toBe(401);
    expect(withNew.status).toBe(200);
  });

  it("near the absolute limit, the new session ends at the absolute expiry, not 7 days later", async () => {
    const user = await createUser();
    const createdAt = new Date(Date.now() - 27 * DAY);
    const absoluteExpiresAt = new Date(Date.now() + 3 * DAY);
    const old = await createSession(user.id, { createdAt, absoluteExpiresAt, expiresAt: absoluteExpiresAt });

    const res = await request(app).post(URL).set("Authorization", `Bearer ${old.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.session.expiresAt).toBe(absoluteExpiresAt.toISOString());
  });

  it("N concurrent refreshes with one token → exactly one success (testing §4.3)", async () => {
    const user = await createUser();
    const old = await createSession(user.id);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(URL).set("Authorization", `Bearer ${old.token}`)),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401).every((r) => r.body.error.code === "INVALID_SESSION")).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
  });

  it("reusing a rotated token → 401 and the replacement session stays valid", async () => {
    const user = await createUser();
    const old = await createSession(user.id);
    const first = await request(app).post(URL).set("Authorization", `Bearer ${old.token}`);

    const reuse = await request(app).post(URL).set("Authorization", `Bearer ${old.token}`);
    const replacement = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${first.body.data.session.accessToken}`);

    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("INVALID_SESSION");
    expect(replacement.status).toBe(200);
  });

  it("expired session cannot be refreshed", async () => {
    const user = await createUser();
    const old = await createSession(user.id, {
      createdAt: new Date(Date.now() - 8 * DAY),
      expiresAt: new Date(Date.now() - DAY),
    });

    const res = await request(app).post(URL).set("Authorization", `Bearer ${old.token}`);

    expect(res.status).toBe(401);
  });

  it("missing header → 401 MISSING_AUTHENTICATION", async () => {
    const res = await request(app).post(URL);

    expect(res.body.error.code).toBe("MISSING_AUTHENTICATION");
  });

  it("if creating the new session fails, the old one is not revoked", async () => {
    const user = await createUser();
    const old = await createSession(user.id);

    const res = await withFailingInserts("sessions", () =>
      request(app).post(URL).set("Authorization", `Bearer ${old.token}`),
    );

    expect(res.status).toBe(500);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: old.session.id } })).revokedAt).toBeNull();
  });
});
