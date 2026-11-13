/**
 * Peg's motion language (design system §10, Peg motion). Two layers:
 *
 * 1. MOVES: a small vocabulary of gestures, each a short Web Animations
 *    keyframe list on the figure's actor (individual translate/rotate/scale,
 *    so they compose with positional motion) plus the mood it wears.
 * 2. TRANSITIONS: named recipes built only from moves and reaches (how far Peg
 *    hangs out of its socket). Screens use a transition by name; they never
 *    invent their own animation, which keeps every screen consistent.
 *
 * Budget: an exit (what plays before navigating) stays under EXIT_BUDGET_MS so
 * the app never feels slow; reduced motion skips moves and holds entirely.
 */

export const EASE = {
  standard: "cubic-bezier(0.22, 1, 0.36, 1)",
  click: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/** Moods a move or step can put on Peg's face (CSS: [data-mood] .peg-fig__*). */
export type PegMood = "idle" | "happy" | "sad" | "wink" | "look";

export type MoveName = "hop" | "nod" | "shake" | "wave" | "squash" | "wink";

export type Move = {
  keyframes: Keyframe[];
  duration: number;
  easing: string;
  mood?: PegMood;
};

export const MOVES: Record<MoveName, Move> = {
  /** Joy: a quick jump with a squash on landing. */
  hop: {
    keyframes: [
      { translate: "0 0", scale: "1 1" },
      { translate: "0 -16px", scale: "0.96 1.04", offset: 0.4 },
      { translate: "0 0", scale: "1.08 0.92", offset: 0.75 },
      { translate: "0 0", scale: "1 1" },
    ],
    duration: 480,
    easing: EASE.standard,
    mood: "happy",
  },
  /** Agreement: "got it", "saved". */
  nod: {
    keyframes: [
      { translate: "0 0" },
      { translate: "0 6px", offset: 0.3 },
      { translate: "0 0", offset: 0.55 },
      { translate: "0 4px", offset: 0.75 },
      { translate: "0 0" },
    ],
    duration: 460,
    easing: EASE.standard,
    mood: "happy",
  },
  /** "No": something went wrong. */
  shake: {
    keyframes: [
      { rotate: "0deg" },
      { rotate: "-9deg", offset: 0.25 },
      { rotate: "8deg", offset: 0.5 },
      { rotate: "-4deg", offset: 0.75 },
      { rotate: "0deg" },
    ],
    duration: 480,
    easing: EASE.standard,
    mood: "sad",
  },
  /** Goodbye: a swing side to side from its socket. */
  wave: {
    keyframes: [
      { rotate: "0deg" },
      { rotate: "11deg", offset: 0.2 },
      { rotate: "-10deg", offset: 0.45 },
      { rotate: "7deg", offset: 0.7 },
      { rotate: "0deg" },
    ],
    duration: 760,
    easing: EASE.standard,
    mood: "happy",
  },
  /** Arrival: the "click" of a peg seating in its socket. */
  squash: {
    keyframes: [{ scale: "1 1" }, { scale: "1.1 0.9", offset: 0.35 }, { scale: "1 1" }],
    duration: 280,
    easing: EASE.click,
  },
  /** Acknowledgement without words (e.g. the theme changed). */
  wink: {
    keyframes: [{ rotate: "0deg" }, { rotate: "-5deg", offset: 0.4 }, { rotate: "0deg" }],
    duration: 520,
    easing: EASE.standard,
    mood: "wink",
  },
};

/** How far Peg hangs out of its socket. */
export type Reach = "hidden" | "rest";

/** Time to let a reach change settle before the next step, in ms. */
export const REACH_MS: Record<Reach, number> = { hidden: 220, rest: 300 };

export type Step = { move: MoveName } | { reach: Reach } | { mood: PegMood; hold: number };

/** How the page content itself moves while Peg performs. */
export type PageMotion = "forward" | "back" | "fade";

export type Transition = {
  /** Plays before navigating (or alone, for transitions without navigation). */
  exit: Step[];
  /** Plays on the new screen, or right after `exit` when nothing navigates. */
  enter: Step[];
  page: PageMotion | null;
};

export type TransitionName = "forward" | "back" | "create" | "save" | "error" | "logout" | "greet" | "theme";

/**
 * The catalogue. Rules that keep it coherent:
 * - going somewhere: Peg ducks into its socket, the page moves, Peg drops back
 *   in on the new page with the squash "click";
 * - feedback in place (save, error, theme): one move, no reach changes;
 * - leaving the app: a wave, then up into the socket for good.
 */
export const TRANSITIONS: Record<TransitionName, Transition> = {
  /** Open something: a workspace, its settings, the create page. */
  forward: {
    exit: [{ reach: "hidden" }],
    enter: [{ reach: "rest" }, { move: "squash" }],
    page: "forward",
  },
  /** Back up a level: breadcrumbs, cancel, the logo. */
  back: {
    exit: [{ reach: "hidden" }],
    enter: [{ reach: "rest" }],
    page: "back",
  },
  /** Something new was made: a hop, then off to it, and a pleased arrival. */
  create: {
    exit: [{ move: "hop" }, { reach: "hidden" }],
    enter: [{ reach: "rest" }, { move: "squash" }, { mood: "happy", hold: 1200 }],
    page: "forward",
  },
  save: { exit: [], enter: [{ move: "nod" }], page: null },
  error: { exit: [], enter: [{ move: "shake" }], page: null },
  theme: { exit: [], enter: [{ move: "wink" }], page: null },
  /** Signing out: wave goodbye, go up into the socket; sign-in takes over. */
  logout: {
    exit: [{ move: "wave" }, { reach: "hidden" }],
    enter: [],
    page: "fade",
  },
  /** Arriving after sign-in: drop out of the socket and stay pleased a while. */
  greet: {
    exit: [],
    enter: [{ reach: "rest" }, { move: "squash" }, { mood: "happy", hold: 3400 }],
    page: null,
  },
};

/** Upper bound for anything played before a navigation (ms). */
export const EXIT_BUDGET_MS = 1000;

/** Duration of a list of steps, as played with full motion. */
export function stepsDuration(steps: Step[]): number {
  return steps.reduce((ms, step) => {
    if ("move" in step) return ms + MOVES[step.move].duration;
    if ("reach" in step) return ms + REACH_MS[step.reach];
    return ms + step.hold;
  }, 0);
}
