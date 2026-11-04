import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import argon2 from "argon2";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { hashSessionToken } from "../../src/modules/identity/session-token.js";

const TEST_EMAIL = "login-test@example.com";
const TEST_PASSWORD = "strongpassword123";

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: await argon2.hash(TEST_PASSWORD),
        displayName: "Login Test User",
      },
    });
  });

  it("should login successfully and create a session", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(TEST_EMAIL);

    const rawToken = response.body.data.sessionToken;

    expect(rawToken).toBeTypeOf("string");

    const session = await prisma.session.findUnique({
      where: {
        tokenHash: hashSessionToken(rawToken),
      },
    });

    expect(session).not.toBeNull();
    expect(session!.userId).toBe(response.body.data.user.id);
  });

  it("should reject an unknown email", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "unknown@example.com",
      password: TEST_PASSWORD,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should reject an incorrect password", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: TEST_EMAIL,
      password: "incorrectpassword",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("should reject invalid input", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "invalid-email",
      password: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
