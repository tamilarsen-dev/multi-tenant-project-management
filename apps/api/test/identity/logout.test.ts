import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../src/modules/identity/session-token.js";

describe("POST /api/v1/auth/logout", () => {
  let token: string;
  let sessionId: string;

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "logout-test@example.com",
        passwordHash: "test-hash",
        displayName: "Logout Test",
      },
    });

    token = generateSessionToken();

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    sessionId = session.id;
  });

  it("should revoke the current session", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    expect(session?.revokedAt).not.toBeNull();
  });

  it("should reject the revoked token on subsequent requests", async () => {
    await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("should reject logout without authentication", async () => {
    const response = await request(app).post("/api/v1/auth/logout");

    expect(response.status).toBe(401);
  });
});
