import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createActor, createMembership, createOrganization } from "../../factories/index.js";
import { resetDatabase } from "../../helpers/database.js";

/** testing §4.1 — two tenants, A and B. */
describe("Organization tenant isolation", () => {
  beforeEach(resetDatabase);

  async function twoTenants() {
    const alice = await createActor();
    const bob = await createActor();
    const a = await createOrganization(alice.user.id, "Tenant A");
    const b = await createOrganization(bob.user.id, "Tenant B");
    return { alice, bob, a, b };
  }

  it("A's member reading B → 404 ORGANIZATION_NOT_FOUND with no B data", async () => {
    const { alice, b } = await twoTenants();

    const res = await request(app).get(`/api/v1/organizations/${b.organization.id}`).set(alice.auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" } });
    expect(JSON.stringify(res.body)).not.toContain("Tenant B");
  });

  it("A's member updating B → 404 and B unchanged", async () => {
    const { alice, b } = await twoTenants();

    const res = await request(app)
      .patch(`/api/v1/organizations/${b.organization.id}`)
      .set(alice.auth)
      .send({ name: "Hijacked", version: 1 });

    expect(res.status).toBe(404);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: b.organization.id } })).name).toBe("Tenant B");
  });

  it("listing in A never includes B and totalCount excludes it", async () => {
    const { alice } = await twoTenants();

    const res = await request(app).get("/api/v1/organizations").set(alice.auth);

    expect(res.body.data.map((i: { organization: { name: string } }) => i.organization.name)).toEqual(["Tenant A"]);
    expect(res.body.pagination.totalCount).toBe(1);
  });

  it("a REMOVED Membership grants nothing", async () => {
    const { bob, a } = await twoTenants();
    await createMembership(a.organization.id, bob.user.id, "ADMIN", "REMOVED");

    const read = await request(app).get(`/api/v1/organizations/${a.organization.id}`).set(bob.auth);
    const write = await request(app)
      .patch(`/api/v1/organizations/${a.organization.id}`)
      .set(bob.auth)
      .send({ name: "X", version: 1 });

    expect(read.status).toBe(404);
    expect(write.status).toBe(404);
  });

  it("nonexistent Organization and Organization without Membership are indistinguishable", async () => {
    const { alice, b } = await twoTenants();
    const missing = "00000000-0000-4000-8000-000000000000";

    const hidden = await request(app).get(`/api/v1/organizations/${b.organization.id}`).set(alice.auth);
    const absent = await request(app).get(`/api/v1/organizations/${missing}`).set(alice.auth);

    expect(hidden.status).toBe(absent.status);
    expect(hidden.body).toEqual(absent.body);
    const volatile = new Set(["date", "x-request-id", "etag"]);
    const strip = (h: Record<string, string>) => Object.keys(h).filter((k) => !volatile.has(k)).sort();
    expect(strip(hidden.headers)).toEqual(strip(absent.headers));
  });
});
