import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createActor, createMembership, createOrganization } from "../../factories/index.js";
import { resetDatabase, withFailingInserts } from "../../helpers/database.js";

const url = (id: string) => `/api/v1/organizations/${id}`;

describe("PATCH /api/v1/organizations/:id (contract §4.4)", () => {
  beforeEach(resetDatabase);

  it("renames, increments version, and records ORGANIZATION_UPDATED", async () => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");

    const res = await request(app).patch(url(organization.id)).set(owner.auth).send({ name: "Acme Tech", version: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.organization).toMatchObject({ name: "Acme Tech", version: 2 });

    const activity = await prisma.activity.findFirstOrThrow({ where: { eventType: "ORGANIZATION_UPDATED" } });
    expect(activity.metadata).toMatchObject({ changes: { name: { from: "Acme", to: "Acme Tech" } } });
  });

  it("no-op → 200, same version, no Activity, even with a stale version", async () => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");
    await prisma.organization.update({ where: { id: organization.id }, data: { version: 3 } });

    const res = await request(app).patch(url(organization.id)).set(owner.auth).send({ name: " Acme ", version: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.organization.version).toBe(3);
    expect(await prisma.activity.count()).toBe(0);
  });

  it("stale version → 409 VERSION_CONFLICT with currentVersion, nothing written", async () => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");
    await request(app).patch(url(organization.id)).set(owner.auth).send({ name: "Acme 2", version: 1 });

    const res = await request(app).patch(url(organization.id)).set(owner.auth).send({ name: "Acme 3", version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "VERSION_CONFLICT", details: { currentVersion: 2 } });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).name).toBe("Acme 2");
  });

  it("two concurrent updates with the same version → one 200, one 409 (testing §4.3)", async () => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");

    const results = await Promise.all([
      request(app).patch(url(organization.id)).set(owner.auth).send({ name: "From A", version: 1 }),
      request(app).patch(url(organization.id)).set(owner.auth).send({ name: "From B", version: 1 }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).version).toBe(2);
    expect(await prisma.activity.count({ where: { eventType: "ORGANIZATION_UPDATED" } })).toBe(1);
  });

  it.each([
    ["OWNER", 200],
    ["ADMIN", 200],
    ["MEMBER", 403],
  ] as const)("role matrix: %s → %i (permissions §2.1)", async (role, status) => {
    const owner = await createActor();
    const caller = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");
    if (role !== "OWNER") await createMembership(organization.id, caller.user.id, role);
    const actor = role === "OWNER" ? owner : caller;

    const res = await request(app).patch(url(organization.id)).set(actor.auth).send({ name: "Renamed", version: 1 });

    expect(res.status).toBe(status);
    if (status === 403) {
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect((await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).name).toBe("Acme");
    }
  });

  it.each([
    ["missing version", { name: "X" }],
    ["version 0", { name: "X", version: 0 }],
    ["unknown field", { name: "X", version: 1, id: "other" }],
  ])("%s → 400", async (_name, body) => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");

    const res = await request(app).patch(url(organization.id)).set(owner.auth).send(body);

    expect(res.status).toBe(400);
  });

  it("rolls back the rename when the Activity insert fails", async () => {
    const owner = await createActor();
    const { organization } = await createOrganization(owner.user.id, "Acme");

    const res = await withFailingInserts("activities", () =>
      request(app).patch(url(organization.id)).set(owner.auth).send({ name: "Renamed", version: 1 }),
    );

    expect(res.status).toBe(500);
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
    expect(after).toMatchObject({ name: "Acme", version: 1 });
  });
});
