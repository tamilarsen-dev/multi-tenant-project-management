/** Session lifetime rules (ADR-0003). Pure: no I/O, no clock access. */

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const ABSOLUTE_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionWindow = { expiresAt: Date; absoluteExpiresAt: Date };

/** A login starts a new refresh chain. */
export function windowForLogin(now: Date): SessionWindow {
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_LIFETIME_MS);
  return { expiresAt: windowEnd(now, absoluteExpiresAt), absoluteExpiresAt };
}

/** A refresh keeps the chain's absolute expiry and never extends it. */
export function windowForRefresh(now: Date, absoluteExpiresAt: Date): SessionWindow {
  return { expiresAt: windowEnd(now, absoluteExpiresAt), absoluteExpiresAt };
}

function windowEnd(now: Date, absoluteExpiresAt: Date): Date {
  const sevenDays = now.getTime() + SESSION_LIFETIME_MS;
  return new Date(Math.min(sevenDays, absoluteExpiresAt.getTime()));
}

/** Emails are trimmed and lowercased once, by this function, everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
