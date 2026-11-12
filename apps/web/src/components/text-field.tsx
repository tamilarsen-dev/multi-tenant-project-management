import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "id" | "name"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Visible label, 48 px control, border-strong; errors are linked with aria-describedby. */
export function TextField({ name, label, hint, error, className = "", ...input }: Props) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-label font-semibold text-text">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          "min-h-12 rounded-control border bg-surface px-4 text-body text-text placeholder:text-text-muted " +
          "focus:outline-none focus-visible:outline-2 focus-visible:outline-accent " +
          (error ? "border-danger-text" : "border-border-strong")
        }
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-label text-danger-text">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-label text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
