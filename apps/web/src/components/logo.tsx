import { useId } from "react";

/** Monogram d (design system §4). The peg always uses the accent role. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const maskId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <mask id={maskId}>
        <rect width="48" height="48" fill="#fff" />
        <rect x="29" y="23" width="8" height="10" fill="#000" />
      </mask>
      <circle cx="20" cy="28" r="14" mask={`url(#${maskId})`} fill="currentColor" />
      <rect x="34" y="6" width="6" height="36" rx="3" fill="currentColor" />
      <rect x="30" y="24" width="4" height="8" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ size = 32, label }: { size?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-text">
      <LogoMark size={size} />
      <span
        className="font-display font-bold tracking-[-0.02em]"
        style={{ fontSize: Math.round(size * 0.68), lineHeight: 1 }}
      >
        {label}
      </span>
    </span>
  );
}

/** Large tone-on-tone mark cropped in a corner. Decoration only. */
export function StageMark() {
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute -right-[190px] -bottom-[150px] hidden size-[700px] text-mark-tint md:block"
    >
      <mask id={maskId}>
        <rect width="48" height="48" fill="#fff" />
        <rect x="29" y="23" width="8" height="10" fill="#000" />
      </mask>
      <circle cx="20" cy="28" r="14" mask={`url(#${maskId})`} fill="currentColor" />
      <rect className="stage-mark-peg" x="30" y="24" width="4" height="8" fill="var(--accent)" />
      <rect x="34" y="6" width="6" height="36" rx="3" fill="currentColor" />
    </svg>
  );
}
