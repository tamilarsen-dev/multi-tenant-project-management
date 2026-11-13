import { MOVES, REACH_MS, type PegMood, type Reach, type Step } from "./motion";

/** What a Peg exposes to the runner. */
export type PegActor = {
  actor: HTMLElement | null;
  setReach: (reach: Reach) => void;
  setMood: (mood: PegMood | null) => void;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

/**
 * Plays steps in order. A newer run aborts this one (its animations stop and
 * the face resets). With reduced motion, moves are skipped, reaches apply at
 * once, and only mood holds remain (they change the face, not position).
 */
export async function runSteps(steps: Step[], peg: PegActor, reduced: boolean, signal: AbortSignal) {
  for (const step of steps) {
    if (signal.aborted) return;
    if ("reach" in step) {
      peg.setReach(step.reach);
      await sleep(reduced ? 0 : REACH_MS[step.reach], signal);
    } else if ("move" in step) {
      if (reduced || !peg.actor) continue;
      const move = MOVES[step.move];
      peg.setMood(move.mood ?? null);
      const animation = peg.actor.animate(move.keyframes, { duration: move.duration, easing: move.easing });
      signal.addEventListener("abort", () => animation.cancel(), { once: true });
      await animation.finished.catch(() => undefined);
      peg.setMood(null);
    } else {
      peg.setMood(step.mood);
      await sleep(step.hold, signal);
      peg.setMood(null);
    }
  }
}
