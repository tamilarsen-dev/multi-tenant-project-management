"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import type { TransitionName } from "./motion";
import { shouldIntercept } from "./navigation";
import { usePeg } from "./peg-provider";

/**
 * A Link that moves with Peg. Use it for every in-app navigation so all
 * screens share the same motion; `transition` names a recipe from motion.ts.
 * Outside the app (no provider), or for modified clicks, it is a plain Link.
 *
 * Prefetch is on intent (hover/focus), not on sight: every page here is per
 * user and costs API calls, and a list of 25 cards prefetched at once would
 * spend the client's rate limit. The click also starts loading while Peg exits.
 */
const NO_MODIFIERS = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

export function PegLink({
  transition = "forward",
  onClick,
  onPointerEnter,
  onFocus,
  prefetch,
  ...props
}: ComponentProps<typeof Link> & { transition?: TransitionName }) {
  const peg = usePeg();
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "");

  return (
    <Link
      {...props}
      prefetch={prefetch ?? (peg ? false : undefined)}
      onPointerEnter={(e) => {
        onPointerEnter?.(e);
        if (peg && shouldIntercept({ ...NO_MODIFIERS }, href)) peg.prefetch(href);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        if (peg && shouldIntercept({ ...NO_MODIFIERS }, href)) peg.prefetch(href);
      }}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !peg || !shouldIntercept(e, href, props.target)) return;
        e.preventDefault();
        peg.navigate(href, transition);
      }}
    />
  );
}
