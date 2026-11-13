import { describe, expect, it } from "vitest";

import { EXIT_BUDGET_MS, MOVES, REACH_MS, stepsDuration, TRANSITIONS, type Step } from "../src/features/peg/motion";
import { shouldIntercept } from "../src/features/peg/navigation";

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe("Peg transitions catalogue", () => {
  it.each(Object.entries(TRANSITIONS))("%s: every exit fits the budget so navigation never feels slow", (_name, t) => {
    expect(stepsDuration(t.exit)).toBeLessThanOrEqual(EXIT_BUDGET_MS);
  });

  it.each(Object.entries(TRANSITIONS))("%s: only uses moves and reaches from the vocabulary", (_name, t) => {
    for (const step of [...t.exit, ...t.enter] as Step[]) {
      if ("move" in step) expect(MOVES).toHaveProperty(step.move);
      if ("reach" in step) expect(REACH_MS).toHaveProperty(step.reach);
    }
  });

  it("going somewhere always hides Peg before and brings it back after", () => {
    for (const name of ["forward", "back", "create"] as const) {
      const t = TRANSITIONS[name];
      expect(t.exit.at(-1)).toEqual({ reach: "hidden" });
      expect(t.enter[0]).toEqual({ reach: "rest" });
      expect(t.page).not.toBeNull();
    }
  });

  it("feedback in place never moves the page or Peg's socket", () => {
    for (const name of ["save", "error", "theme"] as const) {
      const t = TRANSITIONS[name];
      expect(t.page).toBeNull();
      expect([...t.exit, ...t.enter].some((s) => "reach" in s)).toBe(false);
    }
  });

  it("every move is short and keyframed from rest back to rest", () => {
    for (const move of Object.values(MOVES)) {
      expect(move.duration).toBeLessThanOrEqual(800);
      expect(move.keyframes.at(0)).toEqual(move.keyframes.at(-1));
    }
  });
});

describe("shouldIntercept (PegLink)", () => {
  it("plays a transition for a plain left click on an in-app link", () => {
    expect(shouldIntercept(click, "/workspaces/1")).toBe(true);
  });

  it.each([
    ["middle click", { ...click, button: 1 }, "/a", undefined],
    ["cmd/ctrl click (new tab)", { ...click, metaKey: true }, "/a", undefined],
    ["shift click", { ...click, shiftKey: true }, "/a", undefined],
    ["target=_blank", click, "/a", "_blank"],
    ["external link", click, "https://example.com", undefined],
    ["protocol-relative", click, "//evil.example", undefined],
  ])("leaves %s to the browser", (_name, e, href, target) => {
    expect(shouldIntercept(e, href, target)).toBe(false);
  });
});
