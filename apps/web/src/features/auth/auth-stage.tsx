"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Shared state between the auth forms and Peg (design system §10, auth
 * stage). Focus is picked up by event delegation on the stage, so fields only
 * need a `data-stage-field` attribute; the forms report what they alone know:
 * pending submits, failed submits, and whether the password is shown.
 */

export type StageField = "name" | "email" | "password" | "submit";
export type Mood = "idle" | "watch" | "shy" | "look-away" | "busy" | "sad" | "success";

type StageApi = {
  mood: Mood;
  /** The focused field element, read every frame by Peg to aim its gaze. */
  focused: React.RefObject<HTMLElement | null>;
  setPending: (pending: boolean) => void;
  setRevealed: (revealed: boolean) => void;
  flashError: () => void;
  /** Signed in: Peg celebrates and leaves for the app; the form fades out. */
  celebrate: () => void;
};

const StageContext = createContext<StageApi | null>(null);

const ERROR_MS = 1400;

export function AuthStage({ children, className }: { children: React.ReactNode; className?: string }) {
  const focused = useRef<HTMLElement | null>(null);
  const [field, setField] = useState<StageField | null>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const celebrate = useCallback(() => setSuccess(true), []);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flashError = useCallback(() => {
    clearTimeout(errorTimer.current);
    setError(true);
    errorTimer.current = setTimeout(() => setError(false), ERROR_MS);
  }, []);

  useEffect(() => () => clearTimeout(errorTimer.current), []);

  const onFocus = useCallback((event: React.FocusEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-stage-field]");
    focused.current = target;
    setField((target?.dataset.stageField as StageField | undefined) ?? null);
  }, []);

  const onBlur = useCallback((event: React.FocusEvent) => {
    // Moving between two fields fires blur then focus; only clear when focus leaves the stage.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      focused.current = null;
      setField(null);
    }
  }, []);

  const mood = success ? "success" : deriveMood({ pending, error, field, revealed });

  const api = useMemo(
    () => ({ mood, focused, setPending, setRevealed, flashError, celebrate }),
    [mood, flashError, celebrate],
  );

  return (
    <StageContext.Provider value={api}>
      <div
        className={className}
        data-auth-column=""
        data-leaving={success ? "" : undefined}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {children}
      </div>
    </StageContext.Provider>
  );
}

/** Priority: a submit in flight, then a fresh failure, then whatever has focus. */
export function deriveMood(s: { pending: boolean; error: boolean; field: StageField | null; revealed: boolean }): Mood {
  if (s.pending) return "busy";
  if (s.error) return "sad";
  if (s.field === "password") return s.revealed ? "look-away" : "shy";
  if (s.field === "submit") return "idle";
  return s.field ? "watch" : "idle";
}

export function useAuthStage(): StageApi {
  const api = useContext(StageContext);
  if (!api) throw new Error("useAuthStage must be used inside <AuthStage>");
  return api;
}
