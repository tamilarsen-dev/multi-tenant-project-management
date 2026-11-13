"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { GREET_KEY } from "@/lib/peg";

/**
 * Peg in the app (design system §10): plugged into a socket on the bottom
 * edge of the header, it hangs down into the page just far enough to show its
 * face. Right after signing in it drops out of its socket and greets you (the
 * sign-in Peg leapt up and out to get here). After that it keeps you company:
 * blinks, follows the pointer, and grins when poked.
 *
 * Decorative (aria-hidden): the greeting repeats nothing the page needs. One
 * rAF loop drives two springs (length, sway) with transforms only; with
 * reduced motion it simply hangs still.
 */

const BODY_H = 120;
const REST = 44;
const STIFF = 120;
const DAMP = 11; // a little bouncy: it lands with a wobble
const SWAY_STIFF = 50;
const SWAY_DAMP = 7;
const MAX_STEP = 1 / 120;
const GREET_MS = 3400;

export function AppPeg({ name }: { name: string }) {
  const t = useTranslations("peg");
  const root = useRef<HTMLDivElement>(null);
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    let kind: string | null = null;
    try {
      kind = sessionStorage.getItem(GREET_KEY);
      sessionStorage.removeItem(GREET_KEY);
    } catch {
      // No storage: no greeting.
    }
    if (kind !== "signin" && kind !== "signup") return;
    const first = name.trim().split(/\s+/)[0] ?? name;
    const show = setTimeout(() => setGreeting(t(kind === "signup" ? "helloNew" : "helloBack", { name: first })), 450);
    const hide = setTimeout(() => setGreeting(null), 450 + GREET_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [name, t]);

  useEffect(() => {
    const peg = root.current;
    if (!peg) return;
    const body = peg.querySelector<HTMLElement>(".app-peg__body")!;
    const pupils = Array.from(peg.querySelectorAll<HTMLElement>(".app-peg__pupil"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pointer = { x: 0, y: 0, active: false };
    const len = { value: reduced ? REST : 0, v: 0 };
    const sway = { value: 0, v: 0 };
    const look = { x: 0, y: 0 };
    const mountedAt = performance.now();
    let last = mountedAt;
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
      peg.setAttribute("data-poked", "");
      clearTimeout(pokeTimer);
      pokeTimer = setTimeout(() => peg.removeAttribute("data-poked"), 700);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    body.addEventListener("click", onPoke);

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 15);
      last = now;
      // Waits a beat after the page appears, then drops out of its socket.
      const target = now - mountedAt < 250 ? 0 : REST;
      const box = peg.getBoundingClientRect();
      const tipX = box.left + 35;
      const tipY = box.top + len.value;
      const swayTarget = pointer.active ? Math.max(-1, Math.min(1, (tipX - pointer.x) / 600)) * 6 : 0;

      if (!reduced) {
        for (let left = dt; left > 0; left -= MAX_STEP) {
          const h = Math.min(left, MAX_STEP);
          len.v += (STIFF * (target - len.value) - DAMP * len.v) * h;
          len.value += len.v * h;
          sway.v += (SWAY_STIFF * (swayTarget - sway.value) - SWAY_DAMP * sway.v) * h;
          sway.value += sway.v * h;
        }
      }

      body.style.transform = `translateY(${(len.value - BODY_H).toFixed(1)}px) rotate(${sway.value.toFixed(2)}deg)`;
      if (!peg.hasAttribute("data-ready")) peg.setAttribute("data-ready", "");

      if (!reduced) {
        let lx = 0;
        let ly = 0;
        if (pointer.active) {
          const dx = pointer.x - tipX;
          const dy = pointer.y - (tipY - 24);
          const d = Math.hypot(dx, dy) || 1;
          lx = dx / d;
          ly = dy / d;
        }
        look.x += (lx - look.x) * 0.18;
        look.y += (ly - look.y) * 0.18;
        for (const p of pupils) p.style.transform = `translate(${(look.x * 2.5).toFixed(2)}px, ${(look.y * 3).toFixed(2)}px)`;
      }
    };

    const loop = (now: number) => {
      render(now);
      frame = requestAnimationFrame(loop);
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
    <div ref={root} className="app-peg" data-greeting={greeting ? "" : undefined} aria-hidden="true">
      <span className="app-peg__socket" />
      <span className="app-peg__body">
        <span className="app-peg__face">
          <span className="app-peg__eyes">
            <span className="app-peg__eye">
              <span className="app-peg__pupil" />
            </span>
            <span className="app-peg__eye">
              <span className="app-peg__pupil" />
            </span>
          </span>
          <span className="app-peg__mouth" />
        </span>
      </span>
      <span className="app-peg__bubble">{greeting}</span>
    </div>
  );
}
