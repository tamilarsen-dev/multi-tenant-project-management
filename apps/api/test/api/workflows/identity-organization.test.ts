import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { resetDatabase } from "../../helpers/database.js";

/** testing §4.5 workflow 1 — the M1 exit condition, through HTTP only. */
describe("Workflow: register → refresh → organization lifecycle", () => {
  beforeEach(resetDatabase);

  it("works end to end", async () => {
    const credentials = { email: "dana@example.com", password: "correct horse battery" };

    const registered = await request(app).post("/api/v1/auth/register").send({ ...credentials, displayName: "Dana" });
    expect(registered.status).toBe(201);

    const login = await request(app).post("/api/v1/auth/login").send(credentials);
    expect(login.status).toBe(200);

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Authorization", `Bearer ${login.body.data.session.accessToken}`);
    expect(refreshed.status).toBe(200);
    const auth = { Authorization: `Bearer ${refreshed.body.data.session.accessToken}` };

    const created = await request(app).post("/api/v1/organizations").set(auth).send({ name: "Dana's Team" });
    expect(created.status).toBe(201);
    const id = created.body.data.organization.id;

    const listed = await request(app).get("/api/v1/organizations").set(auth);
    expect(listed.body.data).toHaveLength(1);

    const updated = await request(app).patch(`/api/v1/organizations/${id}`).set(auth).send({ name: "Dana & Co", version: 1 });
    expect(updated.body.data.organization).toMatchObject({ name: "Dana & Co", version: 2 });

    const read = await request(app).get(`/api/v1/organizations/${id}`).set(auth);
    expect(read.body.data.organization.name).toBe("Dana & Co");

    const loggedOut = await request(app).post("/api/v1/auth/logout").set(auth);
    expect(loggedOut.status).toBe(204);

    const afterLogout = await request(app).get("/api/v1/organizations").set(auth);
    expect(afterLogout.status).toBe(401);
  });
});
