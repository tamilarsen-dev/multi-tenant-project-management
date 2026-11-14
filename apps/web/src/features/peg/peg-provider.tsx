"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { usePreferences } from "@/features/preferences/preferences-provider";
import { isReducedMotion } from "@/lib/preferences";

import { EXIT_BUDGET_MS, TRANSITIONS, type PageMotion, type TransitionName } from "./motion";
import { runSteps, type PegActor } from "./runner";

/**
 * The app's Peg conductor. Screens ask for a transition by name; the provider
 * plays its exit on the header Peg and the page together, navigates, then plays
 * the enter on the new page. One place, so every screen moves the same way.
 */
type PegApi = {
  /** Feedback in place (save, error, theme): exit then enter, no navigation. */
  play: (name: TransitionName) => Promise<void>;
  /** Exit only, e.g. before signing out; resolves when it is safe to leave. */
  playExit: (name: TransitionName) => Promise<void>;
  /** Exit, navigate, enter. The next page starts loading while Peg exits. */
  navigate: (href: string, name: TransitionName) => void;
  /** Load a page ahead of time (on hover/focus of a link). */
  prefetch: (href: string) => void;
  /** Used by the header Peg to hand over its controls. */
  register: (actor: PegActor | null) => void;
  page: { leaving: PageMotion | null; entering: PageMotion | null };
};

const PegContext = createContext<PegApi | null>(null);

const reducedMotion = isReducedMotion;

export function PegProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { react } = usePreferences();
  const reactRef = useRef(react);
  useEffect(() => {
    reactRef.current = react;
  }, [react]);
  const actor = useRef<PegActor | null>(null);
  const run = useRef<AbortController | null>(null);
  const pendingEnter = useRef<TransitionName | null>(null);
  const [leaving, setLeaving] = useState<PageMotion | null>(null);
  const [entering, setEntering] = useState<PageMotion | null>(null);
  const firstPath = useRef(true);

  const start = useCallback(() => {
    run.current?.abort();
    run.current = new AbortController();
    return run.current.signal;
  }, []);

  const steps = useCallback(async (list: Parameters<typeof runSteps>[0], signal: AbortSignal) => {
    if (actor.current) await runSteps(list, actor.current, { reduced: reducedMotion(), react: reactRef.current }, signal);
  }, []);

  const play = useCallback(
    async (name: TransitionName) => {
      const signal = start();
      const t = TRANSITIONS[name];
      await steps(t.exit, signal);
      await steps(t.enter, signal);
    },
    [start, steps],
  );

  const playExit = useCallback(
    async (name: TransitionName) => {
      const signal = start();
      const t = TRANSITIONS[name];
      if (t.page && !reducedMotion()) setLeaving(t.page);
      await Promise.race([steps(t.exit, signal), new Promise((r) => setTimeout(r, EXIT_BUDGET_MS))]);
    },
    [start, steps],
  );

  const navigate = useCallback(
    (href: string, name: TransitionName) => {
      router.prefetch(href); // load while the exit plays, so the wait is hidden
      void (async () => {
        await playExit(name);
        pendingEnter.current = name;
        router.push(href);
      })();
    },
    [playExit, router],
  );

  // A new page arrived: show it entering, and let Peg come back in.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false; // the header Peg makes its own first entrance
      return;
    }
    const name = pendingEnter.current;
    pendingEnter.current = null;
    setLeaving(null);
    if (!name) {
      // Navigation Peg did not start (browser back/forward): just come back out.
      actor.current?.setReach("rest");
      return;
    }
    const t = TRANSITIONS[name];
    setEntering(t.page);
    const signal = start();
    void steps(t.enter, signal);
    const id = setTimeout(() => setEntering(null), 400);
    return () => clearTimeout(id);
  }, [pathname, start, steps]);

  const prefetch = useCallback((href: string) => router.prefetch(href), [router]);

  const register = useCallback((next: PegActor | null) => {
    actor.current = next;
  }, []);

  const api = useMemo<PegApi>(
    () => ({ play, playExit, navigate, prefetch, register, page: { leaving, entering } }),
    [play, playExit, navigate, prefetch, register, leaving, entering],
  );

  return <PegContext.Provider value={api}>{children}</PegContext.Provider>;
}

/** The conductor, or null outside the app (e.g. on the sign-in page). */
export function usePeg(): PegApi | null {
  return useContext(PegContext);
}

/** Wraps page content so it moves with the transition (fade/slide, ~200–300 ms). */
export function PegPage({ children }: { children: React.ReactNode }) {
  const peg = usePeg();
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="peg-page"
      data-page-leaving={peg?.page.leaving ?? undefined}
      data-page-enter={peg?.page.entering ?? undefined}
    >
      {children}
    </div>
  );
}
