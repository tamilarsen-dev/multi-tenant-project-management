import "server-only";
import { cookies } from "next/headers";

import type { Session } from "@/lib/api/types";
import { cookieNames, cookieOptions, encodeMeta } from "@/lib/session-cookie";

import { serverEnv } from "./env";

function names() {
  return cookieNames(serverEnv().NODE_ENV === "production");
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(names().token)?.value;
}

/** Only callable from Server Functions and Route Handlers (cookies are set on the response). */
export async function storeSession(session: Session): Promise<void> {
  const store = await cookies();
  const production = serverEnv().NODE_ENV === "production";
  const expiresAt = Date.parse(session.expiresAt);
  const options = cookieOptions(production, expiresAt, Date.now());

  store.set(names().token, session.accessToken, options);
  store.set(names().meta, encodeMeta({ expiresAt, absoluteExpiresAt: Date.parse(session.absoluteExpiresAt) }), options);
}

/**
 * Expires both cookies with the attributes they were set with: browsers ignore a
 * deletion of a `__Host-` cookie that lacks `Secure` and `Path=/`.
 */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  const options = cookieOptions(serverEnv().NODE_ENV === "production", 0, 0);
  store.set(names().token, "", options);
  store.set(names().meta, "", options);
}
