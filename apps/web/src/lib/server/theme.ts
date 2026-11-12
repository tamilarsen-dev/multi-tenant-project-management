import "server-only";
import { cookies } from "next/headers";

export const THEME_COOKIE = "detent_theme";
export type ThemePreference = "system" | "light" | "dark";

export function parseTheme(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export async function readTheme(): Promise<ThemePreference> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
