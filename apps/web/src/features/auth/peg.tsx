"use client";

import { useEffect, useRef } from "react";

import { useAuthStage, type Mood } from "./auth-stage";
import { HangingPeg } from "./hanging-peg";

/**
 * Peg (design system §4, §8, §10): the Detent joint's peg, alive.
 *
 * From 640 px Peg climbs the right edge of the form. Its body hides behind
 * the tiles, its two grips hold the edge of a field, and it peeks round to
 * see what you are doing:
 *
 * - idle: holds on beside the first field, blinks, follows the pointer
 * - watch: climbs to the field you are in, leans in and reads along; every
 *   key makes it nod
 * - shy: password hidden, leans back and shuts its eyes
 * - look-away: password shown, leans further back and looks up, whistling
 * - busy: climbs down to the submit button and leans on it
 * - sad: a failed submit, it shakes its head
 * - poke it: it bounces and grins
 *
 * Below 640 px there is no room beside the form, so HangingPeg takes over.
 * Springs in one rAF loop write transforms only; decorative (aria-hidden).
 * With reduced motion Peg moves straight to each spot and does not track.
 */

const BODY_W = 120;
const BODY_H = 144;
/** How much of the body hides behind the field. */
const TUCK = 44;
const CHAR_PX = 8.6;

/** Lean (sideways peek) per mood, in px; negative leans in toward the form. */
const LEAN: Record<Mood, number> = {
  idle: 0,
  watch: -12,
  shy: 22,
  "look-away": 34,
  busy: -14,
  sad: 6,
};

const STIFF = 150;
const DAMP = 15;

export function Peg() {
  return (
    <>
      <HangingPeg />
      <ClimbingPeg />
    </>
  );
}

function ClimbingPeg() {
  const { mood, focused } = useAuthStage();
  const root = useRef<HTMLDivElement>(null);
  const moodRef = useRef<Mood>(mood);

  useEffect(() => {
    moodRef.current = mood;
    root.current?.dispatchEvent(new CustomEvent("peg:mood", { detail: mood }));
  }, [mood]);

  useEffect(() => {
    const peg = root.current;
    const column = peg?.parentElement;
    if (!peg || !column) return;
    const body = peg.querySelector<HTMLElement>(".climber__body")!;
    const hands = Array.from(peg.querySelectorAll<HTMLElement>(".climber__hand"));
    const pupils = Array.from(peg.querySelectorAll<HTMLElement>(".climber__pupil"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = { x: 0, y: 0, active: false };
    const y = { value: 0, v: 0 };
    const lean = { value: 0, v: 0 };
    const shake = { value: 0, v: 0 };
    const look = { x: 0, y: 0 };
    let climbPhase = 0;
    let started = false;
    let last = performance.now();
    let frame = 0;
    let pokeTimer: ReturnType<typeof setTimeout> | undefined;
    let tile: HTMLElement | null = null;

    const fields = () => Array.from(column.querySelectorAll<HTMLElement>("[data-stage-field]"));

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onKey = (e: Event) => {
      if ((e.target as HTMLElement).closest("[data-stage-field]")) y.v += 70;
    };
    const onPoke = () => {
      lean.v -= 320;
      y.v -= 260;
      peg.setAttribute("data-poked", "");
      clearTimeout(pokeTimer);
      pokeTimer = setTimeout(() => peg.removeAttribute("data-poked"), 700);
    };
    const onMood = (e: Event) => {
      if ((e as CustomEvent<Mood>).detail === "sad") shake.v += 420;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    column.addEventListener("input", onKey);
    body.addEventListener("click", onPoke);
    peg.addEventListener("peg:mood", onMood);

    const targetTile = (m: Mood): HTMLElement | null => {
      if (m === "busy") return column.querySelector('[data-stage-field="submit"]');
      const f = focused.current;
      if (f && column.contains(f)) tile = f;
      return tile && column.contains(tile) ? tile : (fields()[0] ?? null);
    };

    const aimFor = (m: Mood, box: DOMRect): { x: number; y: number } | null => {
      if (m === "look-away") return { x: box.right + 400, y: box.top - 600 };
      const f = focused.current;
      if ((m === "watch" || m === "shy") && f) {
        const r = f.getBoundingClientRect();
        const input = f.querySelector("input");
        const typed = Math.min((input?.value.length ?? 0) * CHAR_PX, r.width - 32);
        return { x: r.left + 16 + typed, y: r.top + r.height * 0.6 };
      }
      if (m === "busy") {
        const button = column.querySelector('[data-stage-field="submit"]');
        if (button) {
          const r = button.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
      return pointer.active ? pointer : null;
    };

    const render = (now: number) => {
      if (getComputedStyle(peg).display === "none") return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const m = moodRef.current;
      const target = targetTile(m);
      if (!target) return;

      const colBox = column.getBoundingClientRect();
      const tileBox = target.getBoundingClientRect();
      const ty = tileBox.top - colBox.top + tileBox.height / 2 - BODY_H / 2;
      const tl = LEAN[m];
      const x = tileBox.right - colBox.left - TUCK;

      if (!started || reduced) {
        y.value = ty;
        y.v = 0;
        lean.value = tl;
        lean.v = 0;
        started = true;
      } else {
        y.v += (STIFF * (ty - y.value) - DAMP * y.v) * dt;
        y.value += y.v * dt;
        lean.v += (STIFF * (tl - lean.value) - DAMP * lean.v) * dt;
        lean.value += lean.v * dt;
        shake.v += (-220 * shake.value - 9 * shake.v) * dt;
        shake.value += shake.v * dt;
      }

      // Climbing: grips take turns while Peg moves up or down.
      climbPhase += Math.min(Math.abs(y.v) * dt * 0.08, 0.6);
      const climbing = Math.min(Math.abs(y.v) / 300, 1);

      // No transform on the wrapper: that would make it a stacking context and
      // the body could no longer slip behind the tiles.
      body.style.transform = `translate(${(x + lean.value).toFixed(1)}px, ${y.value.toFixed(1)}px) rotate(${shake.value.toFixed(2)}deg)`;
      hands.forEach((hand, i) => {
        const step = reduced ? 0 : Math.sin(climbPhase + i * Math.PI) * 6 * climbing;
        hand.style.transform = `translate(${x.toFixed(1)}px, ${(y.value + step).toFixed(1)}px)`;
      });

      // The submit button presses down while Peg leans on it.
      const submit = column.querySelector<HTMLElement>('[data-stage-field="submit"]');
      submit?.toggleAttribute("data-pressed", m === "busy");

      if (!reduced) {
        const box = body.getBoundingClientRect();
        const aim = aimFor(m, box);
        let lx = 0;
        let ly = 0;
        if (aim) {
          const eyeX = box.left + BODY_W * 0.68;
          const eyeY = box.top + BODY_H * 0.38;
          const dx = aim.x - eyeX;
          const dy = aim.y - eyeY;
          const d = Math.hypot(dx, dy) || 1;
          lx = dx / d;
          ly = dy / d;
        }
        look.x += (lx - look.x) * 0.18;
        look.y += (ly - look.y) * 0.18;
        for (const p of pupils) p.style.transform = `translate(${(look.x * 4).toFixed(2)}px, ${(look.y * 6).toFixed(2)}px)`;
      }
    };

    const loop = (now: number) => {
      render(now);
      frame = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      cancelAnimationFrame(frame);
      clearTimeout(pokeTimer);
      window.removeEventListener("pointermove", onMove);
      column.removeEventListener("input", onKey);
      body.removeEventListener("click", onPoke);
      peg.removeEventListener("peg:mood", onMood);
    };

    if (reduced) {
      const place = () => render(performance.now());
      place();
      const id = setInterval(place, 200);
      window.addEventListener("resize", place);
      return () => {
        clearInterval(id);
        window.removeEventListener("resize", place);
        cleanup();
      };
    }

    frame = requestAnimationFrame(loop);
    return cleanup;
  }, [focused]);

  return (
    <div ref={root} className="climber" data-mood={mood} aria-hidden="true">
      <span className="climber__body">
        <span className="climber__ridge" />
        <span className="climber__face">
          <span className="climber__eyes">
            <span className="climber__eye">
              <span className="climber__pupil" />
            </span>
            <span className="climber__eye">
              <span className="climber__pupil" />
            </span>
          </span>
          <span className="climber__mouth" />
        </span>
      </span>
      <span className="climber__hand climber__hand--top" />
      <span className="climber__hand climber__hand--bottom" />
    </div>
  );
}
