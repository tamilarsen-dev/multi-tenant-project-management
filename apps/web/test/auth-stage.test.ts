import { describe, expect, it } from "vitest";

import { deriveMood } from "../src/features/auth/auth-stage";

const base = { pending: false, error: false, field: null, revealed: false } as const;

describe("deriveMood (the crew's state)", () => {
  it.each([
    ["nothing focused", base, "idle"],
    ["typing an email", { ...base, field: "email" }, "watch"],
    ["typing a name", { ...base, field: "name" }, "watch"],
    ["password hidden", { ...base, field: "password" }, "shy"],
    ["password shown", { ...base, field: "password", revealed: true }, "look-away"],
    ["shown password only matters while it has focus", { ...base, field: "email", revealed: true }, "watch"],
    ["focus on the submit button", { ...base, field: "submit" }, "idle"],
    ["a failed submit beats focus", { ...base, field: "password", error: true }, "sad"],
    ["a submit in flight beats everything", { ...base, field: "email", error: true, pending: true }, "busy"],
  ] as const)("%s → %s", (_name, state, mood) => {
    expect(deriveMood(state)).toBe(mood);
  });
});
