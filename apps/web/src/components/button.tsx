import Link from "next/link";
import type { ComponentProps } from "react";

import type { TransitionName } from "@/features/peg/motion";
import { PegLink } from "@/features/peg/peg-link";

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

/** A link styled as a button. With `transition`, Peg moves with it (motion.ts). */
export function ButtonLink({
  variant = "primary",
  className = "",
  transition,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; transition?: TransitionName }) {
  if (transition) return <PegLink transition={transition} className={buttonClass(variant, className)} {...props} />;
  return <Link className={buttonClass(variant, className)} {...props} />;
}
