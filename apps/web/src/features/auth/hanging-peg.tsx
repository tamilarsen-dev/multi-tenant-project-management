"use client";

import { useEffect, useRef } from "react";

import { useAuthStage, type Mood } from "./auth-stage";

/**
 * Peg, phone variant (design system §10): plugged into a socket in the bar at
 * the top of the screen, hanging down in the corner. Same moods as the
 * climbing Peg: it lowers and bounces while you type, pulls up and shuts its
 * eyes for a password, hides for a shown password, shakes its head on a
 * failed submit, and grins when poked. Decorative (aria-hidden).
 */

const COMPACT = 60;
const CHAR_PX = 8.6;

/** Spring constants (per second). */
const STIFF = 110;
const DAMP = 17;
const MAX_STEP = 1 / 120;
const SWAY_STIFF = 60;
const SWAY_DAMP = 8;

/** Phone variant: hangs from the bar at the top, in the corner. */
export function HangingPeg() {
  const { mood, focused } = useAuthStage();
  const root = useRef<HTMLDivElement>(null);
  const moodRef = useRef<Mood>(mood);

  useEffect(() => {
    moodRef.current = mood;
    // A failed submit kicks the sway spring; see onMood below.
    root.current?.dispatchEvent(new CustomEvent("peg:mood", { detail: mood }));
  }, [mood]);

  useEffect(() => {
    const peg = root.current;
    if (!peg) return;
    const body = peg.querySelector<HTMLElement>(".peg__body")!;
    const pupils = Array.from(peg.querySelectorAll<HTMLElement>(".peg__pupil"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = { x: 0, y: 0, active: false };
    const len = { value: 0, v: 0 };
    const sway = { value: 0, v: 0 };
    const look = { x: 0, y: 0 };
    let last = performance.now();
    let frame = 0;
    let started = false;
    let pokeTimer: ReturnType<typeof setTimeout> | undefined;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onKey = (e: Event) => {
      if ((e.target as HTMLElement).closest("[data-stage-field]")) len.v += 160;
    };
    const onPoke = () => {
      len.v += 900;
      sway.v += (Math.random() - 0.5) * 60;
      peg.setAttribute("data-poked", "");
      clearTimeout(pokeTimer);
      pokeTimer = setTimeout(() => peg.removeAttribute("data-poked"), 700);
    };
    const onMood = (e: Event) => {
      if ((e as CustomEvent<Mood>).detail === "sad") sway.v += 140;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("input", onKey);
    body.addEventListener("click", onPoke);
    peg.addEventListener("peg:mood", onMood);

    const layout = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = COMPACT;
      return { w, x: vw - w - 12, vh, wide: false };
    };

    const targetFor = (m: Mood, w: number, vh: number, wide: boolean) => {
      const faceToBottom = w * 0.55; // from the bottom of the body to the middle of the eyes
      const rest = wide ? Math.min(Math.max(vh * 0.36, 170), 300) : 70;
      const reach = (el: Element | null | undefined) => {
        if (!el || !wide) return rest;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 + faceToBottom;
      };
      switch (m) {
        case "shy":
          return w * 0.68;
        case "look-away":
          return w * 0.32;
        case "success":
          return 0; // back up into its socket: off to the app
        case "busy":
          return reach(document.querySelector('[data-stage-field="submit"]'));
        case "watch":
          return reach(focused.current);
        default:
          return rest;
      }
    };

    const aimFor = (m: Mood): { x: number; y: number } | null => {
      const el = focused.current;
      if ((m === "watch" || m === "shy") && el) {
        const r = el.getBoundingClientRect();
        const input = el.querySelector("input");
        const typed = Math.min((input?.value.length ?? 0) * CHAR_PX, r.width - 32);
        return { x: r.left + 16 + typed, y: r.top + r.height * 0.6 };
      }
      if (m === "busy") {
        const button = document.querySelector('[data-stage-field="submit"]');
        if (button) {
          const r = button.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
      return pointer.active ? pointer : null;
    };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 15);
      last = now;
      const m = moodRef.current;
      const { w, x, vh, wide } = layout();
      peg.style.setProperty("--peg-w", `${w}px`);

      const target = targetFor(m, w, vh, wide);
      if (!started || reduced) {
        // First frame: still inside its socket; it then lowers itself into view.
        len.value = reduced ? target : 0;
        len.v = 0;
        started = true;
        peg.setAttribute("data-ready", "");
      } else {
        for (let left = dt; left > 0; left -= MAX_STEP) {
          const h = Math.min(left, MAX_STEP);
          len.v += (STIFF * (target - len.value) - DAMP * len.v) * h;
          len.value += len.v * h;
        }
      }

      // Sway toward what it is looking at (the bottom of the body swings toward it).
      const aim = reduced ? null : aimFor(m);
      const tipX = x + w / 2;
      // The longer Peg hangs, the less it may swing: its tip never moves more than ~24 px sideways.
      const maxSway = Math.min(8, (Math.atan(24 / Math.max(len.value, 1)) * 180) / Math.PI);
      const swayTarget = aim ? Math.max(-1, Math.min(1, (tipX - aim.x) / 700)) * maxSway : 0;
      if (!reduced) {
        sway.v += (SWAY_STIFF * (swayTarget - sway.value) - SWAY_DAMP * sway.v) * dt;
        sway.value += sway.v * dt;
        // Hard limit too, so a head shake or a poke can never swing it into the form.
        if (Math.abs(sway.value) > maxSway * 1.4) {
          sway.value = Math.sign(sway.value) * maxSway * 1.4;
          sway.v *= -0.4;
        }
      }

      // Stretch a little with speed: thinner while dropping fast.
      const stretch = reduced ? 1 : 1 - Math.max(-0.06, Math.min(0.06, len.v / 6000));
      const height = peg.offsetHeight;
      peg.style.transform = `translateX(${x.toFixed(1)}px) rotate(${sway.value.toFixed(2)}deg)`;
      body.style.transform = `translateY(${(len.value - height).toFixed(1)}px) scaleX(${stretch.toFixed(3)})`;

      // Pupils: toward the aim, inside the eye.
      if (!reduced) {
        let lx = 0;
        let ly = 0;
        if (aim) {
          const faceY = len.value - w * 0.55;
          const dx = aim.x - tipX;
          const dy = aim.y - faceY;
          const d = Math.hypot(dx, dy) || 1;
          lx = dx / d;
          ly = dy / d;
        }
        look.x += (lx - look.x) * 0.18;
        look.y += (ly - look.y) * 0.18;
        const px = look.x * w * 0.035;
        const py = look.y * w * 0.06;
        for (const p of pupils) p.style.transform = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`;
      }
    };

    const loop = (now: number) => {
      if (peg.offsetParent !== null || getComputedStyle(peg).display !== "none") render(now);
      frame = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      cancelAnimationFrame(frame);
      clearTimeout(pokeTimer);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("input", onKey);
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
    <>
      <div className="peg-bar" aria-hidden="true" />
      <div ref={root} className="peg" data-mood={mood} aria-hidden="true">
        <span className="peg__socket" />
        <span className="peg__body">
          <span className="peg__ridge" style={{ bottom: "calc(var(--peg-w) * 1.02)" }} />
          <span className="peg__ridge" style={{ bottom: "calc(var(--peg-w) * 1.14)" }} />
          <span className="peg__face">
            <span className="peg__eyes">
              <span className="peg__eye">
                <span className="peg__pupil" />
              </span>
              <span className="peg__eye">
                <span className="peg__pupil" />
              </span>
            </span>
            <span className="peg__mouth" />
          </span>
        </span>
      </div>
    </>
  );
}
