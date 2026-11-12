import { describe, expect, it } from "vitest";

import { cookieNames, cookieOptions, decodeMeta, encodeMeta, safeNextPath, shouldRefresh } from "../src/lib/session-cookie";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 11);

describe("cookie names", () => {
  it("uses the __Host- prefix only in production", () => {
    expect(cookieNames(true).token).toBe("__Host-detent_session");
    expect(cookieNames(false).token).toBe("detent_session");
  });
});

describe("cookie options (ADR-0010)", () => {
  it("is HttpOnly, SameSite=Lax, Path=/, Secure in production, and lives as long as the session", () => {
    expect(cookieOptions(true, now + 7 * DAY, now)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  });

  it("never produces a negative max-age", () => {
    expect(cookieOptions(false, now - DAY, now).maxAge).toBe(0);
  });
});

describe("meta cookie", () => {
  it("round-trips", () => {
    const times = { expiresAt: now + DAY, absoluteExpiresAt: now + 30 * DAY };
    expect(decodeMeta(encodeMeta(times))).toEqual(times);
  });

  it.each([undefined, "", "abc", "1.2.3", "-1.5"])("rejects %s", (value) => {
    expect(decodeMeta(value)).toBeNull();
  });
});

describe("shouldRefresh (sliding renewal)", () => {
  const abs = now + 20 * DAY;

  it.each([
    ["more than half the window left", { expiresAt: now + 5 * DAY, absoluteExpiresAt: abs }, false],
    ["less than half left", { expiresAt: now + 2 * DAY, absoluteExpiresAt: abs }, true],
    ["already expired: refresh would fail", { expiresAt: now - 1, absoluteExpiresAt: abs }, false],
    ["capped at the absolute expiry: nothing to gain", { expiresAt: now + DAY, absoluteExpiresAt: now + DAY }, false],
  ])("%s", (_name, times, expected) => {
    expect(shouldRefresh(times, now)).toBe(expected);
  });

  it("does nothing without metadata", () => {
    expect(shouldRefresh(null, now)).toBe(false);
  });
});

describe("safeNextPath (open-redirect guard)", () => {
  it.each([
    ["/workspaces/abc?x=1", "/workspaces/abc?x=1"],
    ["//evil.example", "/workspaces"],
    ["https://evil.example", "/workspaces"],
    ["/\\evil.example", "/workspaces"],
    [undefined, "/workspaces"],
    [["/a"], "/workspaces"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
