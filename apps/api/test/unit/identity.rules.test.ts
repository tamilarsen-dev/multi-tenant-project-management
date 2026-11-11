import { describe, expect, it } from "vitest";

import {
  ABSOLUTE_SESSION_LIFETIME_MS,
  SESSION_LIFETIME_MS,
  normalizeEmail,
  windowForLogin,
  windowForRefresh,
} from "../../src/modules/identity/identity.rules.js";

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-11-01T00:00:00.000Z");
const at = (days: number) => new Date(t0.getTime() + days * DAY);

describe("Session windows (ADR-0003)", () => {
  it("login: expires in 7 days, absolute limit in 30 days", () => {
    const w = windowForLogin(t0);

    expect(w.expiresAt).toEqual(at(7));
    expect(w.absoluteExpiresAt).toEqual(at(30));
    expect(SESSION_LIFETIME_MS).toBe(7 * DAY);
    expect(ABSOLUTE_SESSION_LIFETIME_MS).toBe(30 * DAY);
  });

  it("refresh early in the chain: a fresh 7 days, absolute limit unchanged", () => {
    const w = windowForRefresh(at(10), at(30));

    expect(w.expiresAt).toEqual(at(17));
    expect(w.absoluteExpiresAt).toEqual(at(30));
  });

  it("refresh near the end: capped at the absolute limit, never extended", () => {
    const w = windowForRefresh(at(27), at(30));

    expect(w.expiresAt).toEqual(at(30));
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });
});
