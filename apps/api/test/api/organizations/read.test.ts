import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { createActor, createMembership, createOrganization } from "../../factories/index.js";
import { resetDatabase } from "../../helpers/database.js";

const URL = "/api/v1/organizations";

describe("GET /api/v1/organizations (contract §4.2)", () => {
  beforeEach(resetDatabase);

  it("lists only Organizations with an ACTIVE Membership, newest first, with the caller's membership", async () => {
    const actor = await createActor();
    const other = await createActor();

    const older = await createOrganization(actor.user.id, "Older");
    await prisma.organization.update({ where: { id: older.organization.id }, data: { createdAt: new Date("2026-01-01") } });
    const newer = await createOrganization(other.user.id, "Newer");
    await createMembership(newer.organization.id, actor.user.id, "MEMBER");
    const removed = await createOrganization(other.user.id, "Removed");
    await createMembership(removed.organization.id, actor.user.id, "MEMBER", "REMOVED");
    await createOrganization(other.user.id, "Not mine");

    const res = await request(app).get(URL).set(actor.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { organization: { name: string } }) => i.organization.name)).toEqual(["Newer", "Older"]);
    expect(res.body.data[0].membership).toMatchObject({ role: "MEMBER", user: { id: actor.user.id } });
    expect(res.body.pagination).toEqual({ nextCursor: null, hasMore: false, totalCount: 2 });
  });

  it("pages with a cursor without gaps or duplicates", async () => {
    const actor = await createActor();
    for (let i = 0; i < 5; i += 1) await createOrganization(actor.user.id, `Org ${i}`);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await request(app)
        .get(URL)
        .query({ limit: 2, ...(cursor ? { cursor } : {}) })
        .set(actor.auth);
      expect(res.status).toBe(200);
      expect(res.body.pagination.totalCount).toBe(5);
      seen.push(...res.body.data.map((i: { organization: { id: string } }) => i.organization.id));
      cursor = res.body.pagination.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it.each([{ limit: "0" }, { limit: "101" }, { cursor: "not-a-cursor" }])("invalid query %o → 400", async (query) => {
    const actor = await createActor();

    const res = await request(app).get(URL).query(query).set(actor.auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("no memberships → 200 with an empty list", async () => {
    const actor = await createActor();

    const res = await request(app).get(URL).set(actor.auth);

    expect(res.body).toEqual({ data: [], pagination: { nextCursor: null, hasMore: false, totalCount: 0 } });
  });
});

describe("GET /api/v1/organizations/:id (contract §4.3)", () => {
  beforeEach(resetDatabase);

  it("returns the Organization with version and the caller's Membership", async () => {
    const actor = await createActor();
    const { organization } = await createOrganization(actor.user.id, "Acme");

    const res = await request(app).get(`${URL}/${organization.id}`).set(actor.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.organization).toMatchObject({ id: organization.id, name: "Acme", version: 1 });
    expect(res.body.data.membership).toMatchObject({ role: "OWNER", status: "ACTIVE" });
  });

  it("malformed id → 400", async () => {
    const actor = await createActor();

    const res = await request(app).get(`${URL}/not-a-uuid`).set(actor.auth);

    expect(res.status).toBe(400);
  });
});
