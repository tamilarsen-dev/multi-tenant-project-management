"use server";

import { cookies } from "next/headers";

import { parseTheme, THEME_COOKIE } from "@/lib/server/theme";

/** Stored per browser for now; per-user storage needs an API field (design system §12). */
export async function setTheme(formData: FormData): Promise<void> {
  const theme = parseTheme(String(formData.get("theme") ?? ""));
  const store = await cookies();
  if (theme === "system") {
    store.delete(THEME_COOKIE);
  } else {
    store.set(THEME_COOKIE, theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365, httpOnly: true });
  }
}
