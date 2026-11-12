/** Form-level message. Rendered inside a live region so screen readers announce it. */
export function FormAlert({ message, tone = "danger" }: { message?: string; tone?: "danger" | "success" }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} aria-live="polite">
      {message ? (
        <p
          className={
            "rounded-control px-4 py-3 text-label " +
            (tone === "danger" ? "bg-danger-bg text-danger-text" : "bg-success-bg text-success-text")
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
