"use client";

import { useRef } from "react";

import { signOut } from "@/features/auth/actions";
import { usePeg } from "@/features/peg/peg-provider";

/** Plays Peg's "logout" (a wave, then up into its socket) before signing out. */
export function SignOutButton({ label }: { label: string }) {
  const peg = usePeg();
  const ready = useRef(false);

  return (
    <form
      action={signOut}
      onSubmit={(e) => {
        if (ready.current || !peg) return;
        e.preventDefault();
        const form = e.currentTarget;
        void peg.playExit("logout").then(() => {
          ready.current = true;
          form.requestSubmit();
        });
      }}
    >
      <button
        type="submit"
        className="min-h-11 rounded-control px-3 text-label font-semibold text-text hover:bg-surface-sunken"
      >
        {label}
      </button>
    </form>
  );
}
