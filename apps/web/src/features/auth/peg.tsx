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
  watch: -4,
  shy: 22,
  "look-away": 34,
  busy: -6,
  sad: 6,
};

/** Springs (per second): close to critically damped, so moves settle without wobbling. */
const STIFF = 110;
const DAMP = 19;
const LEAN_STIFF = 130;
const LEAN_DAMP = 19;
/** Fully tucked behind the field: where Peg starts, before it peeks out. */
const HIDDEN_LEAN = -(BODY_W - TUCK) - 8;
/**
 * The entrance, in ms after the page appears: Peg peeks out from behind the
 * submit button as if through a door, looks left and right, then jumps up to
 * the first field and grabs its edge. Any interaction cuts straight to the jump.
 */
const INTRO = { peek: 350, lookLeft: 950, lookRight: 1350, jump: 1750 };
const JUMP_MS = 560;
const JUMP_HEIGHT = 70;
const JUMP_OUT = 40;
/** Integrate in small steps so a slow frame (dev mode, busy tab) never makes a jump. */
const MAX_STEP = 1 / 120;

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
    const mountedAt = performance.now();
    let introDone = reduced;
    let jump: { start: number; fromY: number; fromLean: number } | null = null;
    let landTimer: ReturnType<typeof setTimeout> | undefined;
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
      const dt = Math.min((now - last) / 1000, 1 / 15);
      last = now;
      const m = moodRef.current;
      const t = now - mountedAt;
      const submitTile = column.querySelector<HTMLElement>('[data-stage-field="submit"]');

      // Intro, before the jump: waiting at the "door" behind the submit button.
      const atDoor = !introDone && !jump && t < INTRO.jump && m === "idle";
      const target = atDoor ? submitTile : targetTile(m);
      if (!target) return;

      const colBox = column.getBoundingClientRect();
      const tileBox = target.getBoundingClientRect();
      const ty = tileBox.top - colBox.top + tileBox.height / 2 - BODY_H / 2;
      const tl = atDoor && t < INTRO.peek ? HIDDEN_LEAN : LEAN[m];
      const x = tileBox.right - colBox.left - TUCK;
      let tilt = 0;
      let flying = false;
      let introAim: { x: number; y: number } | null = null;
      if (atDoor && t >= INTRO.lookLeft) {
        const left = t < INTRO.lookRight;
        introAim = { x: left ? colBox.left - 800 : colBox.right + 800, y: tileBox.top };
      }

      if (!started || reduced) {
        // First frame: already at the right height, tucked out of sight.
        y.value = ty;
        y.v = 0;
        lean.value = reduced ? tl : HIDDEN_LEAN;
        lean.v = 0;
        started = true;
      } else if (!introDone && !atDoor) {
        // The jump: a fixed arc from the door to the target field, out and up.
        jump ??= { start: now, fromY: y.value, fromLean: lean.value };
        const p = Math.min((now - jump.start) / JUMP_MS, 1);
        const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        const arc = Math.sin(Math.PI * p);
        y.value = jump.fromY + (ty - jump.fromY) * ease - arc * JUMP_HEIGHT;
        lean.value = jump.fromLean + (tl - jump.fromLean) * ease + arc * JUMP_OUT;
        tilt = -arc * 12;
        flying = p > 0.06 && p < 0.94;
        introAim = { x: tileBox.left + 40, y: tileBox.top };
        if (p >= 1) {
          introDone = true;
          y.v = 0;
          lean.v = -140; // grabbing the edge pulls it in a little
          peg.setAttribute("data-landed", "");
          clearTimeout(landTimer);
          landTimer = setTimeout(() => peg.removeAttribute("data-landed"), 300);
        }
      } else {
        for (let left = dt; left > 0; left -= MAX_STEP) {
          const h = Math.min(left, MAX_STEP);
          y.v += (STIFF * (ty - y.value) - DAMP * y.v) * h;
          y.value += y.v * h;
          lean.v += (LEAN_STIFF * (tl - lean.value) - LEAN_DAMP * lean.v) * h;
          lean.value += lean.v * h;
          shake.v += (-220 * shake.value - 9 * shake.v) * h;
          shake.value += shake.v * h;
        }
      }

      if (!peg.hasAttribute("data-ready")) peg.setAttribute("data-ready", "");

      // Climbing: grips take turns while Peg moves up or down.
      climbPhase += Math.min(Math.abs(y.v) * dt * 0.08, 0.6);
      const climbing = Math.min(Math.abs(y.v) / 300, 1);

      // No transform on the wrapper: that would make it a stacking context and
      // the body could no longer slip behind the tiles.
      body.style.transform = `translate(${(x + lean.value).toFixed(1)}px, ${y.value.toFixed(1)}px) rotate(${(shake.value + tilt).toFixed(2)}deg)`;
      // The part left of the field's edge is not drawn, and the cut is rounded
      // like Peg's own corners, so it reads as a whole body beside the form rather
      // than one sliced off. It also hides the body above and below short tiles
      // (the submit "door"). In the air, nothing is cut.
      const behind = Math.max(0, TUCK - lean.value);
      body.style.clipPath = flying ? "none" : `inset(0px 0px 0px ${behind.toFixed(1)}px round 30px 46px 46px 30px)`;
      // Grips appear as Peg comes out from behind the field; in the air it lets go.
      const out = flying ? 0 : Math.max(0, Math.min(1, (lean.value - HIDDEN_LEAN) / 40));
      hands.forEach((hand, i) => {
        hand.style.opacity = out.toFixed(2);
        const step = reduced ? 0 : Math.sin(climbPhase + i * Math.PI) * 6 * climbing;
        hand.style.transform = `translate(${x.toFixed(1)}px, ${(y.value + step).toFixed(1)}px)`;
      });

      // The submit button presses down while Peg leans on it.
      const submit = column.querySelector<HTMLElement>('[data-stage-field="submit"]');
      submit?.toggleAttribute("data-pressed", m === "busy");

      if (!reduced) {
        const box = body.getBoundingClientRect();
        const aim = introAim ?? aimFor(m, box);
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
      clearTimeout(landTimer);
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
