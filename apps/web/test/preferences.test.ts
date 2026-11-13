import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from "../src/lib/preferences";

describe("preferences cookie", () => {
  it("defaults to everything on and motion matching the device", () => {
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ peg: true, follow: true, react: true, greet: true, motion: "system" });
  });

  it("round-trips", () => {
    const prefs = { peg: false, follow: true, react: false, greet: true, motion: "reduce" } as const;
    expect(parsePreferences(serializePreferences(prefs))).toEqual(prefs);
    expect(serializePreferences(prefs)).toBe("peg=0;follow=1;react=0;greet=1;motion=reduce");
  });

  it("keeps valid fields and defaults the rest when the cookie is damaged or tampered with", () => {
    expect(parsePreferences("peg=0;follow=yes;motion=fast;admin=1;react")).toEqual({
      ...DEFAULT_PREFERENCES,
      peg: false,
    });
  });

  it("ignores garbage entirely", () => {
    expect(parsePreferences("%%%;;==")).toEqual(DEFAULT_PREFERENCES);
  });
});
