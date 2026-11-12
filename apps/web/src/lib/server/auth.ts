import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { User } from "@/lib/api/types";
import { PATH_HEADER } from "@/lib/request-path";
import { safeNextPath } from "@/lib/session-cookie";

import { ApiFailure, apiRequest, type ApiRequestOptions, type ApiResult } from "./api";
import { readSessionToken } from "./session";

async function currentPath(): Promise<string> {
  return safeNextPath((await headers()).get(PATH_HEADER));
}

/** The caller's token, or a redirect to sign in that returns here afterwards. */
export async function requireToken(): Promise<string> {
  const token = await readSessionToken();
  if (!token) redirect(`/sign-in?next=${encodeURIComponent(await currentPath())}`);
  return token;
}

/**
 * An API call as the signed-in user. A 401 means the session is gone (expired,
 * revoked, or rotated by a parallel request): /auth/expired re-checks the
 * cookie, then either returns here or clears it and asks the user to sign in.
 */
export async function authedRequest<T>(
  path: string,
  options: Omit<ApiRequestOptions, "token"> = {},
): Promise<ApiResult<T>> {
  const token = await requireToken();
  const result = await apiRequest<T>(path, { ...options, token });

  if (!result.ok && result.status === 401) {
    redirect(`/auth/expired?next=${encodeURIComponent(await currentPath())}`);
  }
  return result;
}

/** Deduplicated per request, so the layout and the page share one /auth/me call. */
export const getCurrentUser = cache(async (): Promise<User> => {
  const result = await authedRequest<{ user: User }>("/api/v1/auth/me");
  if (!result.ok) throw new ApiFailure(result.error);
  return result.data.user;
});
