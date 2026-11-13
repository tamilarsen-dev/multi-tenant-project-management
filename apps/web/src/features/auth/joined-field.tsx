"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";

import { GREET_KEY, type Greeting } from "@/lib/peg";

import { useAuthStage, type StageField } from "./auth-stage";

/**
 * A joined tile (design system §10, auth screens): label inside the tile, and
 * from the second tile on a notch on the top edge with a peg bridging the gap.
 * `stageField` tells the stage (and Peg) which field has focus; `revealable`
 * adds a show/hide toggle for passwords.
 */
type Props = Omit<ComponentProps<"input">, "id" | "name"> & {
  name: string;
  label: string;
  stageField: StageField;
  joined?: boolean;
  revealable?: boolean;
  error?: string;
  hint?: string;
};

export function JoinedField({
  name,
  label,
  stageField,
  joined = false,
  revealable = false,
  error,
  hint,
  type,
  ...input
}: Props) {
  const t = useTranslations("auth");
  const { setRevealed } = useAuthStage();
  const [shown, setShown] = useState(false);
  const id = `auth-${name}`;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  function toggle() {
    const next = !shown;
    setShown(next);
    setRevealed(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        data-stage-field={stageField}
        className={
          "joint-tile flex flex-col gap-0.5 rounded-card border bg-surface px-4 py-2.5 " +
          "focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent)] " +
          (error ? "border-danger-text" : "border-border-strong")
        }
      >
        {joined ? (
          <>
            <span className="joint-notch" aria-hidden="true" />
            <span className="joint-peg" aria-hidden="true" />
          </>
        ) : null}
        <label htmlFor={id} className="text-[13px] leading-tight font-semibold text-text-muted">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={id}
            name={name}
            type={revealable && shown ? "text" : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="min-w-0 flex-1 bg-transparent py-1 text-body text-text outline-none placeholder:text-text-muted"
            {...input}
          />
          {revealable ? (
            <button
              type="button"
              onClick={toggle}
              aria-controls={id}
              aria-pressed={shown}
              aria-label={shown ? t("hidePasswordLabel") : t("showPasswordLabel")}
              className="-my-2 -mr-2 min-h-11 rounded-control px-2 text-label font-semibold text-accent-ink hover:bg-surface-sunken"
            >
              {shown ? t("hidePassword") : t("showPassword")}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="ml-1 text-label text-danger-text">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={`${id}-hint`} className="ml-1 text-[13px] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function JoinedSubmit({ label, pendingLabel, pending }: { label: string; pendingLabel: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-stage-field="submit"
      className={
        "joint-tile joint-submit flex min-h-14 items-center justify-center rounded-card border border-accent bg-accent " +
        "text-body font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-progress disabled:opacity-80 " +
        "focus-visible:outline-accent-ink focus-visible:outline-offset-[3px]"
      }
    >
      <span className="joint-notch" aria-hidden="true" />
      <span className="joint-peg" aria-hidden="true" />
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Peg's exit takes this long before the app opens (design system §10). */
export const EXIT_MS = 900;

/**
 * Forms call this with their action state: Peg reacts to pending and failed
 * submits, and on success it celebrates and leaves before the app opens.
 */
export function useStageSignals(
  pending: boolean,
  state: { status: string; redirectTo?: string },
  greeting: Greeting,
) {
  const { setPending, flashError, celebrate } = useAuthStage();
  const router = useRouter();
  useEffect(() => setPending(pending), [pending, setPending]);
  useEffect(() => {
    if (state.status === "error") flashError();
    if (state.status === "success" && state.redirectTo) {
      celebrate();
      try {
        sessionStorage.setItem(GREET_KEY, greeting);
      } catch {
        // Storage can be unavailable (private mode); the greeting is optional.
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const to = state.redirectTo;
      router.prefetch(to);
      const timer = setTimeout(() => router.replace(to), reduced ? 0 : EXIT_MS);
      return () => clearTimeout(timer);
    }
    // Keyed on the action result object: one reaction per submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
