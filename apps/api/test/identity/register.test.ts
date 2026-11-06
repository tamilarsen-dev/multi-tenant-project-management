import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import argon2 from "argon2";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { hashSessionToken } from "../../src/modules/identity/session-token.js";
import { sessionRepository } from "../../src/modules/identity/session.repository.js";

const TEST_EMAIL = "register-test@example.com";
const TEST_PASSWORD = "strongpassword123";

describe("POST /api/v1/auth/register", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  it("should register a user and create a session", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "Test User",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      email: TEST_EMAIL,
      displayName: "Test User",
    });
    expect(response.body.data.sessionToken).toBeTypeOf("string");

    const users = await prisma.user.findMany();
    const sessions = await prisma.session.findMany();

    expect(users).toHaveLength(1);
    expect(sessions).toHaveLength(1);
  });

  it("should reject an already registered email", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "First User",
    });

    const response = await request(app).post("/api/v1/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "Second User",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.session.count()).toBe(1);
  });

  it("should reject invalid registration input", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: "invalid-email",
      password: "short",
      displayName: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("should store password and session token only as hashes", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "Test User",
    });

    const user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
    });

    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe(TEST_PASSWORD);
    expect(await argon2.verify(user!.passwordHash, TEST_PASSWORD)).toBe(true);

    const rawToken = response.body.data.sessionToken as string;
    const tokenHash = hashSessionToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
    });

    expect(session).not.toBeNull();
    expect(session!.tokenHash).not.toBe(rawToken);
  });

  it("should rollback user creation when session creation fails", async () => {
    vi.spyOn(sessionRepository, "create").mockRejectedValue(
      new Error("Simulated session creation failure"),
    );

    const response = await request(app).post("/api/v1/auth/register").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: "Test User",
    });

    expect(response.status).toBe(500);

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });
});
