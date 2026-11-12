import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { OrganizationWithMembership, Pagination } from "@/lib/api/types";
import { ApiFailure } from "@/lib/server/api";
import { authedRequest } from "@/lib/server/auth";

/** Workspace = Organization in the interface (design system §3). */

export const PAGE_SIZE = 20;

const UNEXPECTED = { code: "INTERNAL_SERVER_ERROR", message: "List response without pagination" } as const;

export type WorkspacePage = { items: OrganizationWithMembership[]; pagination: Pagination };

export async function listWorkspaces(cursor?: string): Promise<WorkspacePage> {
  const result = await authedRequest<OrganizationWithMembership[]>("/api/v1/organizations", {
    query: { limit: PAGE_SIZE, cursor },
  });
  if (!result.ok || !result.pagination) throw new ApiFailure(result.ok ? UNEXPECTED : result.error);
  return { items: result.data, pagination: result.pagination };
}

/** Cached per request: generateMetadata and the page share one call. */
export const getWorkspace = cache(async (id: string): Promise<OrganizationWithMembership> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await authedRequest<OrganizationWithMembership>(`/api/v1/organizations/${id}`);
  if (!result.ok) {
    if (result.error.code === "ORGANIZATION_NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    throw new ApiFailure(result.error);
  }
  return result.data;
});

/** Mirrors the API rule (permissions §2.1) to decide what to show; the API still enforces it. */
export function canManage(role: OrganizationWithMembership["membership"]["role"]): boolean {
  return role === "OWNER" || role === "ADMIN";
}
