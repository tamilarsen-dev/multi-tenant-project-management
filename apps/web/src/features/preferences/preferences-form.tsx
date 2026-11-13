"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { usePeg } from "@/features/peg/peg-provider";
import type { MotionPreference, Preferences } from "@/lib/preferences";

import { savePreferences } from "./actions";

type Flag = "peg" | "follow" | "react" | "greet";

/**
 * Preferences, saved on every change (no Save button). Each switch is a native
 * checkbox with role="switch", so it works with keyboard and screen readers.
 */
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const t = useTranslations("preferences");
  const peg = usePeg();
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [, startTransition] = useTransition();

  function save(change: Partial<Preferences>) {
    const next = { ...prefs, ...change };
    setPrefs(next);
    setStatus("saving");
    startTransition(async () => {
      try {
        await savePreferences(change);
        setStatus("saved");
        // A small acknowledgement, which the preference itself may have just turned off.
        if (next.peg && next.react && change.peg === undefined) void peg?.play("save");
      } catch {
        setStatus("failed");
      }
    });
  }

  const flag = (key: Flag, disabled = false) => (
    <Switch
      id={`pref-${key}`}
      label={t(`${key}.label`)}
      description={t(`${key}.description`)}
      checked={prefs[key]}
      disabled={disabled}
      onChange={(value) => save({ [key]: value })}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="pref-peg-title" className="flex flex-col gap-5 rounded-tile border border-border bg-surface p-6 shadow-1">
        <div className="flex flex-col gap-1">
          <h2 id="pref-peg-title" className="text-h3 font-semibold">
            {t("pegTitle")}
          </h2>
          <p className="text-text-muted">{t("pegIntro")}</p>
        </div>
        {flag("peg")}
        <div className="flex flex-col gap-5 border-l-2 border-border pl-4" aria-disabled={!prefs.peg}>
          {flag("follow", !prefs.peg)}
          {flag("react", !prefs.peg)}
          {flag("greet", !prefs.peg)}
        </div>
      </section>

      <section aria-labelledby="pref-motion-title" className="flex flex-col gap-4 rounded-tile border border-border bg-surface p-6 shadow-1">
        <div className="flex flex-col gap-1">
          <h2 id="pref-motion-title" className="text-h3 font-semibold">
            {t("motionTitle")}
          </h2>
          <p className="text-text-muted">{t("motionIntro")}</p>
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">{t("motionTitle")}</legend>
          {(["system", "reduce"] as MotionPreference[]).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-card border border-border p-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40"
            >
              <input
                type="radio"
                name="motion"
                value={value}
                checked={prefs.motion === value}
                onChange={() => save({ motion: value })}
                className="mt-1 size-4 accent-[var(--accent)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{t(`motion.${value}.label`)}</span>
                <span className="text-label text-text-muted">{t(`motion.${value}.description`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <p role="status" aria-live="polite" className="min-h-6 text-label text-text-muted">
        {status === "saving" ? t("saving") : status === "saved" ? t("saved") : status === "failed" ? t("failed") : ""}
      </p>
    </div>
  );
}

function Switch({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex flex-col gap-0.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <span id={`${id}-desc`} className="text-label text-text-muted">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-desc`}
        onChange={(e) => onChange(e.target.checked)}
        className={
          "relative mt-0.5 h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface-sunken " +
          "transition-colors duration-150 checked:border-accent checked:bg-accent disabled:cursor-not-allowed " +
          "before:absolute before:top-[3px] before:left-[3px] before:size-5 before:rounded-full before:bg-surface before:shadow-1 " +
          "before:transition-transform before:duration-150 checked:before:translate-x-5"
        }
      />
    </div>
  );
}
