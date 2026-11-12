/**
 * Session cookie rules (ADR-0010). Pure functions, shared by the proxy and
 * server code, so they can be unit tested without a request.
 */

const SECURE_PREFIX = "__Host-";

export function cookieNames(production: boolean) {
  const prefix = production ? SECURE_PREFIX : "";
  return { token: `${prefix}detent_session`, meta: `${prefix}detent_session_meta` };
}

export type SessionTimes = { expiresAt: number; absoluteExpiresAt: number };

/** `meta` cookie: "<expiresAt ms>.<absoluteExpiresAt ms>". Not secret; used to decide when to refresh. */
export function encodeMeta(times: SessionTimes): string {
  return `${times.expiresAt}.${times.absoluteExpiresAt}`;
}

export function decodeMeta(value: string | undefined): SessionTimes | null {
  const match = value?.match(/^(\d{1,15})\.(\d{1,15})$/);
  if (!match) return null;
  return { expiresAt: Number(match[1]), absoluteExpiresAt: Number(match[2]) };
}

export function cookieOptions(production: boolean, expiresAt: number, now: number) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt - now) / 1000)),
  };
}

const HALF_LIFETIME_MS = 3.5 * 24 * 60 * 60 * 1000;

/**
 * Sliding renewal: refresh once less than half of the 7-day window is left, as
 * long as the absolute expiry still lets the window grow. An expired session
 * cannot be refreshed (ADR-0003), so waiting for a 401 would be too late.
 */
export function shouldRefresh(times: SessionTimes | null, now: number): boolean {
  if (!times || times.expiresAt <= now) return false;
  const canExtend = times.expiresAt < times.absoluteExpiresAt;
  return canExtend && times.expiresAt - now < HALF_LIFETIME_MS;
}

/** Only same-site relative paths survive; anything else falls back. Prevents open redirects. */
export function safeNextPath(value: unknown, fallback = "/workspaces"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
