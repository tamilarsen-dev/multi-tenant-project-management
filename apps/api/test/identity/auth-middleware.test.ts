import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../src/modules/identity/session-token.js";

const TEST_EMAIL = "middleware-test@example.com";

describe("Authentication Middleware", () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: "test-hash",
        displayName: "Middleware Test User",
      },
    });

    userId = user.id;
  });

  async function createSession(options?: {
    expiresAt?: Date;
    revokedAt?: Date | null;
  }) {
    const token = generateSessionToken();

    await prisma.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: options?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: options?.revokedAt ?? null,
      },
    });

    return token;
  }

  it("should authenticate a valid session token", async () => {
    const token = await createSession();

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: userId,
      email: TEST_EMAIL,
      displayName: "Middleware Test User",
    });

    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("should reject a missing authorization header", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });

  it("should reject an invalid token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("should reject an expired session", async () => {
    const token = await createSession({
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("should reject a revoked session", async () => {
    const token = await createSession({
      revokedAt: new Date(),
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });
});
