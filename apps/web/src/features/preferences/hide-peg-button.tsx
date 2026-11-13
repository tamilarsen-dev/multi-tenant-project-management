"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { usePreferences } from "./preferences-provider";
import { savePreferences } from "./actions";

/**
 * On the sign-in screens: switch Peg off (or back on) without having to sign
 * in first. The full set of options lives in Preferences.
 */
export function HidePegButton() {
  const t = useTranslations("preferences");
  const { peg } = usePreferences();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={!peg}
      onClick={() => startTransition(() => savePreferences({ peg: !peg }).then(() => undefined))}
      className="min-h-11 rounded-control px-3 text-label text-text-muted underline-offset-4 hover:text-text hover:underline"
    >
      {peg ? t("hidePeg") : t("showPeg")}
    </button>
  );
}
