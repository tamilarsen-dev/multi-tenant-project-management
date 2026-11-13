"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { GREET_KEY } from "@/lib/peg";

import type { PegMood, Reach } from "./motion";
import { aimPupils, PegFigure } from "./peg-figure";
import { usePeg } from "./peg-provider";

/**
 * Peg in the app (design system §10): plugged into a socket on the header's
 * bottom edge, hanging just far enough to show its face. It hands its controls
 * (reach, mood, actor) to the PegProvider, which plays named transitions on it.
 * On its own it blinks, follows the pointer, and grins when poked; right after
 * sign-in it plays "greet" with a bubble.
 *
 * Decorative (aria-hidden). Springs (length, sway) in one rAF loop, transforms
 * only; with reduced motion it hangs still.
 */

const WIDTH = 56;
const BODY_H = 120;
const LENGTH: Record<Reach, number> = { hidden: 0, rest: 44 };
const STIFF = 120;
const DAMP = 12;
const SWAY_STIFF = 50;
const SWAY_DAMP = 7;
const MAX_STEP = 1 / 120;

export function AppPeg({ name }: { name: string }) {
  const t = useTranslations("peg");
  const peg = usePeg();
  const root = useRef<HTMLDivElement>(null);
  const reach = useRef<Reach>("hidden");
  const [mood, setMood] = useState<PegMood | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);

  // Hand the controls to the conductor, then make the first entrance.
  useEffect(() => {
    const el = root.current;
    if (!peg || !el) return;
    peg.register({
      actor: el.querySelector<HTMLElement>(".peg-fig__actor"),
      setReach: (r) => (reach.current = r),
      setMood,
    });

    let kind: string | null = null;
    try {
      kind = sessionStorage.getItem(GREET_KEY);
      sessionStorage.removeItem(GREET_KEY);
    } catch {
      // No storage: no greeting.
    }
    const greets = kind === "signin" || kind === "signup";
    const first = name.trim().split(/\s+/)[0] ?? name;
    const timer = setTimeout(() => {
      if (greets) {
        setGreeting(t(kind === "signup" ? "helloNew" : "helloBack", { name: first }));
        void peg.play("greet").then(() => setGreeting(null));
      } else {
        reach.current = "rest";
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      peg.register(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const body = el.querySelector<HTMLElement>(".app-peg__body")!;
    const pupils = Array.from(el.querySelectorAll<HTMLElement>(".peg-fig__pupil"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = { x: 0, y: 0, active: false };
    const len = { value: 0, v: 0 };
    const sway = { value: 0, v: 0 };
    const look = { x: 0, y: 0 };
    let last = performance.now();
    let frame = 0;
    let pokeTimer: ReturnType<typeof setTimeout> | undefined;

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onPoke = () => {
      len.v += 420;
      sway.v += (Math.random() - 0.5) * 80;
      el.setAttribute("data-poked", "");
      clearTimeout(pokeTimer);
      pokeTimer = setTimeout(() => el.removeAttribute("data-poked"), 700);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    body.addEventListener("click", onPoke);

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 1 / 15);
      last = now;
      const target = LENGTH[reach.current];
      const box = el.getBoundingClientRect();
      const tipX = box.left + 35;
      const swayTarget = pointer.active ? Math.max(-1, Math.min(1, (tipX - pointer.x) / 600)) * 6 : 0;

      if (reduced) {
        len.value = target;
      } else {
        for (let left = dt; left > 0; left -= MAX_STEP) {
          const h = Math.min(left, MAX_STEP);
          len.v += (STIFF * (target - len.value) - DAMP * len.v) * h;
          len.value += len.v * h;
          sway.v += (SWAY_STIFF * (swayTarget - sway.value) - SWAY_DAMP * sway.v) * h;
          sway.value += sway.v * h;
        }
      }

      body.style.transform = `translateY(${(len.value - BODY_H).toFixed(1)}px) rotate(${sway.value.toFixed(2)}deg)`;
      if (!el.hasAttribute("data-ready")) el.setAttribute("data-ready", "");

      if (!reduced) {
        let lx = 0;
        let ly = 0;
        if (pointer.active) {
          const dx = pointer.x - tipX;
          const dy = pointer.y - (box.top + len.value - 24);
          const d = Math.hypot(dx, dy) || 1;
          lx = dx / d;
          ly = dy / d;
        }
        look.x += (lx - look.x) * 0.18;
        look.y += (ly - look.y) * 0.18;
        aimPupils(pupils, look, WIDTH);
      }
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(pokeTimer);
      window.removeEventListener("pointermove", onMove);
      body.removeEventListener("click", onPoke);
    };
  }, []);

  return (
    <div
      ref={root}
      className="app-peg"
      data-mood={mood ?? (greeting ? "happy" : undefined)}
      data-greeting={greeting ? "" : undefined}
      aria-hidden="true"
    >
      <span className="app-peg__socket" />
      <span className="app-peg__body" style={{ "--peg-w": `${WIDTH}px` } as React.CSSProperties}>
        <PegFigure shape="hang" />
      </span>
      <span className="app-peg__bubble">{greeting}</span>
    </div>
  );
}
