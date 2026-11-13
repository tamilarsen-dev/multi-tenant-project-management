/**
 * Interface preferences (design system §10, Peg settings). Stored in one cookie
 * per browser until the API has a user preferences resource, like the theme.
 * Pure: parsed on the server for the first render, so nothing flashes.
 */

export type MotionPreference = "system" | "reduce";

export type Preferences = {
  /** Peg is shown at all (sign-in, phones, the app header). */
  peg: boolean;
  /** Peg's eyes and sway follow the pointer. */
  follow: boolean;
  /** Peg acts out reactions: hop, nod, shake, wave, the entrance jump. */
  react: boolean;
  /** Peg greets you after signing in. */
  greet: boolean;
  /** "reduce" turns motion down everywhere, whatever the device says. */
  motion: MotionPreference;
};

export const PREFERENCES_COOKIE = "detent_prefs";

export const DEFAULT_PREFERENCES: Preferences = {
  peg: true,
  follow: true,
  react: true,
  greet: true,
  motion: "system",
};

const FLAGS = ["peg", "follow", "react", "greet"] as const;

/** Compact and readable: `peg=1;follow=0;react=1;greet=1;motion=reduce`. */
export function serializePreferences(p: Preferences): string {
  return [...FLAGS.map((k) => `${k}=${p[k] ? 1 : 0}`), `motion=${p.motion}`].join(";");
}

/** Unknown keys and bad values fall back to the defaults, one field at a time. */
export function parsePreferences(value: string | undefined | null): Preferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (!value) return result;
  for (const part of value.split(";")) {
    const [key, raw] = part.split("=");
    if ((FLAGS as readonly string[]).includes(key ?? "") && (raw === "0" || raw === "1")) {
      result[key as (typeof FLAGS)[number]] = raw === "1";
    } else if (key === "motion" && (raw === "system" || raw === "reduce")) {
      result.motion = raw;
    }
  }
  return result;
}

/** Reduced motion from the saved preference or the device (client only). */
export function isReducedMotion(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
