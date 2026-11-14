"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { usePeg } from "@/features/peg/peg-provider";
import { setTheme } from "@/features/theme-actions";

type Theme = "system" | "light" | "dark";

/**
 * Calls the server action directly on change (the form is the no-JS fallback).
 * Submitting the form would let React reset it after the action, which
 * snapped the select back to its first value.
 */
export function ThemeMenu({ current }: { current: Theme }) {
  const t = useTranslations("nav");
  const [, startTransition] = useTransition();
  const peg = usePeg();
  const [value, setValue] = useState<Theme>(current);

  return (
    <form action={setTheme} className="flex items-center gap-2">
      <label htmlFor="theme" className="text-label text-text-muted">
        {t("theme")}
      </label>
      <select
        id="theme"
        name="theme"
        value={value}
        onChange={(e) => {
          const next = e.target.value as Theme;
          setValue(next);
          const data = new FormData();
          data.set("theme", next);
          startTransition(() => setTheme(data));
          void peg?.play("theme");
        }}
        className="min-h-11 rounded-control border border-border-strong bg-surface px-3 text-label text-text"
      >
        <option value="system">{t("themeSystem")}</option>
        <option value="light">{t("themeLight")}</option>
        <option value="dark">{t("themeDark")}</option>
      </select>
      <noscript>
        <button type="submit">{t("theme")}</button>
      </noscript>
    </form>
  );
}
