import "server-only";
import { cookies } from "next/headers";

import { parsePreferences, PREFERENCES_COOKIE, type Preferences } from "@/lib/preferences";

export async function readPreferences(): Promise<Preferences> {
  return parsePreferences((await cookies()).get(PREFERENCES_COOKIE)?.value);
}
