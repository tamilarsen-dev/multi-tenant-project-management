import { describe, expect, it } from "vitest";

import messages from "../messages/en.json";

/** Every API error code the forms can surface has designed copy (design system §3). */
describe("messages", () => {
  it.each(["INVALID_CREDENTIALS", "EMAIL_ALREADY_EXISTS", "RATE_LIMIT_EXCEEDED", "FORBIDDEN", "VERSION_CONFLICT", "API_UNAVAILABLE", "UNKNOWN"])(
    "errors.%s exists",
    (code) => {
      expect((messages.errors as Record<string, unknown>)[code]).toEqual(expect.any(String));
    },
  );

  it("uses the design's sign-in error copy verbatim", () => {
    expect(messages.errors.INVALID_CREDENTIALS).toBe("That email and password don't match.");
  });

  it("has a label for every role", () => {
    expect(Object.keys(messages.roles).sort()).toEqual(["ADMIN", "MEMBER", "OWNER"]);
  });
});
