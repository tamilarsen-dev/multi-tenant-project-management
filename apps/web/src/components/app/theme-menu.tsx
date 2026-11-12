"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { setTheme } from "@/features/theme-actions";

type Theme = "system" | "light" | "dark";

/** Submits on change; the server action stores the choice and the page re-renders with it. */
export function ThemeMenu({ current }: { current: Theme }) {
  const t = useTranslations("nav");
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={setTheme} className="flex items-center gap-2">
      <label htmlFor="theme" className="text-label text-text-muted">
        {t("theme")}
      </label>
      <select
        id="theme"
        name="theme"
        defaultValue={current}
        onChange={() => form.current?.requestSubmit()}
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
