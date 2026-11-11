import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createActor } from "../../factories/index.js";
import { resetDatabase, withFailingInserts } from "../../helpers/database.js";

const URL = "/api/v1/organizations";

describe("POST /api/v1/organizations (contract §4.1)", () => {
  beforeEach(resetDatabase);

  it("creates the Organization, an ACTIVE OWNER Membership, and ORGANIZATION_CREATED", async () => {
    const actor = await createActor({ displayName: "Alice" });

    const res = await request(app).post(URL).set(actor.auth).send({ name: "  Acme Engineering  " });

    expect(res.status).toBe(201);
    const { organization, membership } = res.body.data;
    expect(res.headers.location).toBe(`/api/v1/organizations/${organization.id}`);
    expect(organization).toEqual({
      id: expect.any(String),
      name: "Acme Engineering",
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(membership).toMatchObject({
      organizationId: organization.id,
      user: { id: actor.user.id, displayName: "Alice" },
      role: "OWNER",
      status: "ACTIVE",
      version: 1,
      removedAt: null,
    });

    const activity = await prisma.activity.findFirstOrThrow({ where: { organizationId: organization.id } });
    expect(activity).toMatchObject({
      actorUserId: actor.user.id,
      eventType: "ORGANIZATION_CREATED",
      metadata: {
        schemaVersion: 1,
        entityType: "ORGANIZATION",
        entityId: organization.id,
        changes: { name: { from: null, to: "Acme Engineering" } },
        ownerMembershipId: membership.id,
      },
    });
  });

  it("names are not unique", async () => {
    const actor = await createActor();

    await request(app).post(URL).set(actor.auth).send({ name: "Acme" });
    const second = await request(app).post(URL).set(actor.auth).send({ name: "Acme" });

    expect(second.status).toBe(201);
  });

  it.each([
    ["missing name", {}],
    ["blank name", { name: "   " }],
    ["too long", { name: "A".repeat(101) }],
    ["client-chosen role", { name: "Acme", role: "MEMBER" }],
  ])("%s → 400 and nothing created", async (_name, body) => {
    const actor = await createActor();

    const res = await request(app).post(URL).set(actor.auth).send(body);

    expect(res.status).toBe(400);
    expect(await prisma.organization.count()).toBe(0);
  });

  it("unauthenticated → 401", async () => {
    const res = await request(app).post(URL).send({ name: "Acme" });

    expect(res.status).toBe(401);
  });

  it.each(["memberships", "activities"])(
    "rolls back everything when inserting into %s fails (testing §4.4)",
    async (table) => {
      const actor = await createActor();

      const res = await withFailingInserts(table, () => request(app).post(URL).set(actor.auth).send({ name: "Acme" }));

      expect(res.status).toBe(500);
      expect(await prisma.organization.count()).toBe(0);
      expect(await prisma.membership.count()).toBe(0);
      expect(await prisma.activity.count()).toBe(0);
    },
  );
});
