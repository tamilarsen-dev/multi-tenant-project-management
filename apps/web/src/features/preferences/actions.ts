"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { parsePreferences, PREFERENCES_COOKIE, serializePreferences, type Preferences } from "@/lib/preferences";

/**
 * Saves a change to the interface preferences. Accepts a partial update so
 * each switch can save on its own; unknown values keep the current setting.
 */
export async function savePreferences(change: Partial<Preferences>): Promise<Preferences> {
  const store = await cookies();
  const current = parsePreferences(store.get(PREFERENCES_COOKIE)?.value);
  // The argument comes from the browser: take only known keys with valid values.
  const next: Preferences = { ...current };
  for (const key of ["peg", "follow", "react", "greet"] as const) {
    if (typeof change[key] === "boolean") next[key] = change[key];
  }
  if (change.motion === "system" || change.motion === "reduce") next.motion = change.motion;
  store.set(PREFERENCES_COOKIE, serializePreferences(next), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return next;
}
