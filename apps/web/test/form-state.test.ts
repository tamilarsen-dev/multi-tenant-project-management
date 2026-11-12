import { describe, expect, it } from "vitest";

import { fieldMessages, formErrorKey, messageForIssue } from "../src/lib/form-state";

describe("messageForIssue", () => {
  it.each([
    ["password", "too_small", { key: "passwordMin" }],
    ["name", "too_small", { key: "required" }],
    ["email", "invalid_format", { key: "email" }],
    ["name", "too_big", { key: "tooLong", values: { max: 100 } }],
    ["email", "too_big", { key: "tooLong", values: { max: 254 } }],
    ["email", "invalid_type", { key: "required" }],
    ["name", "something_new", { key: "invalid" }],
  ])("%s / %s", (field, code, expected) => {
    expect(messageForIssue(field, code)).toEqual(expected);
  });
});

describe("fieldMessages", () => {
  it("maps API validation details to the first message per known field", () => {
    const issues = [
      { path: ["password"], code: "too_small" },
      { path: ["password"], code: "too_big" },
      { path: ["email"], code: "invalid_format" },
      { path: ["query", "cursor"], code: "custom" },
    ];
    expect(fieldMessages(issues, ["email", "password"] as const)).toEqual({
      password: { key: "passwordMin" },
      email: { key: "email" },
    });
  });
});

describe("formErrorKey", () => {
  it("keeps codes with designed copy and hides the rest behind UNKNOWN", () => {
    expect(formErrorKey("INVALID_CREDENTIALS")).toBe("INVALID_CREDENTIALS");
    expect(formErrorKey("INTERNAL_SERVER_ERROR")).toBe("UNKNOWN");
  });
});
