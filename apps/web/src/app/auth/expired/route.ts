import { NextResponse, type NextRequest } from "next/server";

import type { User } from "@/lib/api/types";
import { safeNextPath } from "@/lib/session-cookie";
import { apiRequest } from "@/lib/server/api";
import { clearSession, readSessionToken } from "@/lib/server/session";

/**
 * Landing point when an API call answered 401. Re-checks the cookie first: a
 * parallel request may have rotated the session a moment ago, in which case the
 * browser now holds a valid token and the user goes straight back.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const token = await readSessionToken();

  if (token) {
    const me = await apiRequest<{ user: User }>("/api/v1/auth/me", { token });
    if (me.ok) return NextResponse.redirect(new URL(next, request.url));
    if (me.status !== 401) {
      // API down: keep the cookie and let the page show its error state.
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  await clearSession();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", next);
  signIn.searchParams.set("reason", "expired");
  return NextResponse.redirect(signIn);
}
