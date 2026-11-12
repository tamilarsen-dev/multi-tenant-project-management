/**
 * Empty state built from the joint geometry (§8): two tiles, the lower one's
 * notch waiting for the peg. Decorative; the text carries the meaning.
 */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-5 rounded-tile border border-dashed border-border px-6 py-14 text-center">
      <svg width="120" height="88" viewBox="0 0 120 88" aria-hidden="true" focusable="false">
        <rect x="10" y="4" width="100" height="30" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x="10" y="52" width="100" height="30" rx="10" fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x="31" y="51" width="18" height="6" rx="0" fill="var(--bg)" />
        <rect x="34" y="33" width="12" height="22" rx="3" fill="var(--accent)" />
      </svg>
      <div className="flex max-w-sm flex-col gap-2">
        <h2 className="text-h3 font-semibold text-text">{title}</h2>
        <p className="text-body text-text-muted">{body}</p>
      </div>
      {action}
    </section>
  );
}
