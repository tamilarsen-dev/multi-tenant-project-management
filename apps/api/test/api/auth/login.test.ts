import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/db/client.js";
import { DEFAULT_PASSWORD, createUser } from "../../factories/index.js";
import { resetDatabase } from "../../helpers/database.js";

const URL = "/api/v1/auth/login";

describe("POST /api/v1/auth/login (contract §3.2)", () => {
  beforeEach(resetDatabase);

  it("valid credentials → 200 with a new session; other sessions stay valid", async () => {
    await createUser({ email: "bob@example.com" });

    const first = await request(app).post(URL).send({ email: "BOB@example.com", password: DEFAULT_PASSWORD });
    const second = await request(app).post(URL).send({ email: "bob@example.com", password: DEFAULT_PASSWORD });

    expect(first.status).toBe(200);
    expect(first.body.data.user.email).toBe("bob@example.com");
    expect(first.body.data.session.tokenType).toBe("Bearer");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${first.body.data.session.accessToken}`);
    expect(me.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await prisma.session.count()).toBe(2);
  });

  it("unknown email and wrong password are indistinguishable (security §3)", async () => {
    await createUser({ email: "bob@example.com" });

    const unknown = await request(app).post(URL).send({ email: "nobody@example.com", password: DEFAULT_PASSWORD });
    const wrong = await request(app).post(URL).send({ email: "bob@example.com", password: "wrong password!!" });

    for (const res of [unknown, wrong]) {
      expect(res.status).toBe(401);
      expect(res.headers["www-authenticate"]).toBe("Bearer");
    }
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("runs an Argon2 verification even when the email is unknown", async () => {
    const verify = vi.spyOn(argon2, "verify");

    await request(app).post(URL).send({ email: "nobody@example.com", password: DEFAULT_PASSWORD });

    expect(verify).toHaveBeenCalled();
  });

  it("invalid input → 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post(URL).send({ email: "nope", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
