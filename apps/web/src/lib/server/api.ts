import "server-only";

import { headers as requestHeaders } from "next/headers";

import type { ApiErrorBody, Pagination } from "@/lib/api/types";

import { serverEnv } from "./env";

/**
 * The only way the web app talks to the API. Runs on the Next.js server; the
 * browser never sees the token (ADR-0010). Never cached: every response is per user.
 */

export type ApiError = ApiErrorBody | { code: "API_UNAVAILABLE"; message: string; details?: undefined };

export type ApiResult<T> =
  | { ok: true; status: number; data: T; pagination?: Pagination }
  | { ok: false; status: number; error: ApiError };

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

const TIMEOUT_MS = 10_000;

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const url = new URL(path, serverEnv().API_URL);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const clientIp = await clientAddress();
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return unavailable();
  }

  if (response.status === 204) {
    return { ok: true, status: 204, data: undefined as T };
  }

  const json: unknown = await response.json().catch(() => undefined);

  if (response.ok) {
    const body = json as { data: T; pagination?: Pagination };
    return { ok: true, status: response.status, data: body.data, pagination: body.pagination };
  }

  if (isErrorEnvelope(json)) {
    return { ok: false, status: response.status, error: json.error };
  }

  return response.status >= 500 ? unavailable() : { ok: false, status: response.status, error: unknownError() };
}

/**
 * Every user reaches the API from this server's address, so the BFF passes the
 * browser's address on; the API trusts it only from this host (TRUST_PROXY).
 * Next.js fills X-Forwarded-For from the socket unless a client already sent
 * one, so in production a reverse proxy in front must overwrite the header.
 */
export async function clientAddress(): Promise<string | undefined> {
  try {
    const value = (await requestHeaders()).get("x-forwarded-for");
    return value?.split(",")[0]?.trim() || undefined;
  } catch {
    return undefined; // outside a request (e.g. build time)
  }
}

function isErrorEnvelope(value: unknown): value is { error: ApiErrorBody } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: { code?: unknown } }).error?.code === "string"
  );
}

function unavailable(): ApiResult<never> {
  return { ok: false, status: 503, error: { code: "API_UNAVAILABLE", message: "API unavailable" } };
}

function unknownError(): ApiErrorBody {
  return { code: "INTERNAL_SERVER_ERROR", message: "Unexpected response" };
}

/** Thrown for failures a page cannot handle locally; caught by the nearest error boundary. */
export class ApiFailure extends Error {
  constructor(readonly error: ApiError) {
    super(`API request failed: ${error.code}`);
  }
}
