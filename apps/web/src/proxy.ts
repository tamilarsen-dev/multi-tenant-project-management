import { NextResponse, type NextRequest } from "next/server";

import { PATH_HEADER } from "@/lib/request-path";
import { cookieNames, cookieOptions, decodeMeta, encodeMeta, shouldRefresh } from "@/lib/session-cookie";

/**
 * Optimistic routing only (ADR-0010): the real check is the API answering 401.
 * - Pages need a session cookie; auth pages bounce signed-in users.
 * - Sliding renewal: on a full page load past half the session window, rotate
 *   the token and hand the new one to this request and the browser.
 */

const AUTH_PAGES = ["/sign-in", "/create-account"];

export async function proxy(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const names = cookieNames(production);
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(names.token)?.value;
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!token && !isAuthPage) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // `reason=expired` comes from /auth/expired, which has just cleared the cookie;
  // never bounce it back even if a stale cookie survived, or the two would loop.
  if (token && isAuthPage && request.nextUrl.searchParams.get("reason") !== "expired") {
    return NextResponse.redirect(new URL("/workspaces", request.url));
  }

  request.headers.set(PATH_HEADER, pathname + search);

  const isDocument = request.headers.get("sec-fetch-dest") === "document";
  const times = decodeMeta(request.cookies.get(names.meta)?.value);
  const now = Date.now();

  if (token && isDocument && shouldRefresh(times, now)) {
    const session = await refresh(token, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim());
    if (session) {
      const expiresAt = Date.parse(session.expiresAt);
      const meta = encodeMeta({ expiresAt, absoluteExpiresAt: Date.parse(session.absoluteExpiresAt) });
      request.cookies.set(names.token, session.accessToken);
      request.cookies.set(names.meta, meta);

      const response = NextResponse.next({ request: { headers: request.headers } });
      const options = cookieOptions(production, expiresAt, now);
      response.cookies.set(names.token, session.accessToken, options);
      response.cookies.set(names.meta, meta, options);
      return response;
    }
    // A failed refresh is not fatal: the old token may still be valid, and if it
    // is not, the page's API call answers 401 and /auth/expired takes over.
  }

  return NextResponse.next({ request: { headers: request.headers } });
}

type RefreshedSession = { accessToken: string; expiresAt: string; absoluteExpiresAt: string };

async function refresh(token: string, clientIp: string | undefined): Promise<RefreshedSession | null> {
  try {
    const response = await fetch(new URL("/api/v1/auth/refresh", process.env.API_URL ?? "http://localhost:3000"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data: { session: RefreshedSession } };
    return body.data.session;
  } catch {
    return null;
  }
}

export const config = {
  // Everything except Next internals, static files, and the session-recovery route.
  matcher: ["/((?!_next/|auth/expired|favicon.ico|.*\\.(?:svg|png|jpg|ico|woff2)$).*)"],
};
