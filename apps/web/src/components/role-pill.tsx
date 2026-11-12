/** Status pill (§10): word plus colour, 12 px, full radius. Roles use the accent pair. */
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-caption font-semibold text-accent-ink">
      {children}
    </span>
  );
}
