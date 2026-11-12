"use client";

import { useFormStatus } from "react-dom";

import { Button } from "./button";

/** Disables itself and swaps its label while the enclosing form is submitting. */
export function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
