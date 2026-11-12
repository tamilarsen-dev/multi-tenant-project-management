import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/** Design system §10: 48 px tall, radius 10, verb-first labels. */
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-body font-semibold " +
  "transition-[background-color,border-color,color,transform] duration-[120ms] ease-standard " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-text hover:bg-surface-sunken",
  ghost: "text-text hover:bg-surface-sunken",
  danger: "bg-danger-text text-surface hover:opacity-90",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
