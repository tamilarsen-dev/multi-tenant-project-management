import type { ComponentProps } from "react";

/**
 * A joined tile (design system §10, auth screens): label inside the tile, and
 * from the second tile on a notch on the top edge with a peg bridging the gap.
 */
type Props = Omit<ComponentProps<"input">, "id" | "name"> & {
  name: string;
  label: string;
  joined?: boolean;
  error?: string;
  hint?: string;
};

export function JoinedField({ name, label, joined = false, error, hint, ...input }: Props) {
  const id = `auth-${name}`;
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div
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
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full bg-transparent py-1 text-body text-text outline-none placeholder:text-text-muted"
          {...input}
        />
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
