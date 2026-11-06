import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { app } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../src/modules/identity/session-token.js";
import { organizationRepository } from "../../src/modules/organization/organization.repository.js";

const ENDPOINT = "/api/v1/organizations";

describe("POST /api/v1/organizations", () => {
  async function createAuthenticatedUser() {
    const user = await prisma.user.create({
      data: {
        email: "organization-test@example.com",
        passwordHash: "test-password-hash",
        displayName: "Organization Test User",
      },
    });

    const token = generateSessionToken();

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return { user, token };
  }

  beforeEach(async () => {
    await prisma.membership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create an organization and assign creator as OWNER", async () => {
    const { user, token } = await createAuthenticatedUser();

    const response = await request(app)
      .post(ENDPOINT)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Acme Corporation",
      });

    expect(response.status).toBe(201);

    const organizationId = response.body.data.organization.id;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    expect(organization).toMatchObject({
      id: organizationId,
      name: "Acme Corporation",
    });

    const membership = await prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
    });

    expect(membership).toMatchObject({
      organizationId,
      userId: user.id,
      role: "OWNER",
    });
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app).post(ENDPOINT).send({
      name: "Acme Corporation",
    });

    expect(response.status).toBe(401);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
  });

  it("should reject an empty organization name", async () => {
    const { token } = await createAuthenticatedUser();

    const response = await request(app)
      .post(ENDPOINT)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "",
      });

    expect(response.status).toBe(400);
    expect(await prisma.organization.count()).toBe(0);
  });

  it("should reject a name longer than 100 characters", async () => {
    const { token } = await createAuthenticatedUser();

    const response = await request(app)
      .post(ENDPOINT)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "A".repeat(101),
      });

    expect(response.status).toBe(400);
    expect(await prisma.organization.count()).toBe(0);
  });

  it("should reject a missing organization name", async () => {
    const { token } = await createAuthenticatedUser();

    const response = await request(app)
      .post(ENDPOINT)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(await prisma.organization.count()).toBe(0);
  });

  it("should rollback organization creation if membership creation fails", async () => {
    const { token } = await createAuthenticatedUser();

    vi.spyOn(organizationRepository, "createMembership").mockRejectedValueOnce(
      new Error("Simulated membership creation failure"),
    );

    const response = await request(app)
      .post(ENDPOINT)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Acme Corporation",
      });

    expect(response.status).toBe(500);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.membership.count()).toBe(0);
  });
});
