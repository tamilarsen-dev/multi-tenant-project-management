import argon2 from "argon2";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { hashSessionToken } from "../../../src/modules/identity/session-token.js";
import { resetDatabase, withFailingInserts } from "../../helpers/database.js";

const URL = "/api/v1/auth/register";
const PASSWORD = "correct horse battery";
const valid = { email: "  Alice@Example.com ", password: PASSWORD, displayName: " Alice " };

describe("POST /api/v1/auth/register (contract §3.1)", () => {
  beforeEach(resetDatabase);

  it("creates the user and a first session, returning { user, session }", async () => {
    const res = await request(app).post(URL).send(valid);

    expect(res.status).toBe(201);
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      email: "alice@example.com",
      displayName: "Alice",
      createdAt: expect.any(String),
    });
    expect(res.body.data.session).toEqual({
      id: expect.any(String),
      accessToken: expect.stringMatching(/^[0-9a-f]{64}$/),
      tokenType: "Bearer",
      expiresAt: expect.any(String),
      absoluteExpiresAt: expect.any(String),
    });

    const days = (iso: string) => (Date.parse(iso) - Date.now()) / 86_400_000;
    expect(days(res.body.data.session.expiresAt)).toBeCloseTo(7, 1);
    expect(days(res.body.data.session.absoluteExpiresAt)).toBeCloseTo(30, 1);
  });

  it("stores only hashes: Argon2id password and SHA-256 token", async () => {
    const res = await request(app).post(URL).send(valid);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "alice@example.com" } });

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.passwordHash, PASSWORD)).toBe(true);

    const token = res.body.data.session.accessToken as string;
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash: hashSessionToken(token) } });
    expect(session.tokenHash).not.toBe(token);
  });

  it("duplicate email after normalization → 409 EMAIL_ALREADY_EXISTS", async () => {
    await request(app).post(URL).send(valid);
    const res = await request(app).post(URL).send({ ...valid, email: "alice@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(await prisma.user.count()).toBe(1);
  });

  it("concurrent duplicate registrations → one 201, one 409, never a 500", async () => {
    const results = await Promise.all([request(app).post(URL).send(valid), request(app).post(URL).send(valid)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it.each([
    ["short password", { ...valid, password: "short" }],
    ["invalid email", { ...valid, email: "not-an-email" }],
    ["blank display name", { ...valid, displayName: "   " }],
    ["unknown field", { ...valid, role: "OWNER" }],
  ])("%s → 400 VALIDATION_ERROR and nothing stored", async (_name, body) => {
    const res = await request(app).post(URL).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.user.count()).toBe(0);
  });

  it("does not trim the password", async () => {
    await request(app).post(URL).send({ ...valid, password: `  ${PASSWORD}  ` });
    const login = await request(app).post("/api/v1/auth/login").send({ email: valid.email, password: PASSWORD });

    expect(login.status).toBe(401);
  });

  it("rolls back the user when session creation fails (testing §4.4)", async () => {
    const res = await withFailingInserts("sessions", () => request(app).post(URL).send(valid));

    expect(res.status).toBe(500);
    expect(await prisma.user.count()).toBe(0);
  });
});
