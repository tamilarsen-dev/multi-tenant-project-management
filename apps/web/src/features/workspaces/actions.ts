"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import type { OrganizationWithMembership } from "@/lib/api/types";
import type { FormState } from "@/lib/form-state";
import { authedRequest } from "@/lib/server/auth";
import { text, translateFormError, translateIssues } from "@/lib/server/form";
import { renameWorkspaceSchema, workspaceNameSchema } from "@/lib/validation";

import { getWorkspace, listWorkspaces, type WorkspacePage } from "./api";

export type WorkspaceField = "name";
const FIELDS = ["name"] as const;

function validationIssues(details: unknown) {
  return details && typeof details === "object" && "fields" in details
    ? (details as { fields: { path: (string | number)[]; code: string }[] }).fields
    : [];
}

export async function createWorkspace(
  _prev: FormState<WorkspaceField>,
  formData: FormData,
): Promise<FormState<WorkspaceField>> {
  const values = { name: text(formData, "name") };
  const parsed = workspaceNameSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: await translateIssues(parsed.error.issues, FIELDS), values };
  }

  const result = await authedRequest<OrganizationWithMembership>("/api/v1/organizations", {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) {
    if (result.error.code === "VALIDATION_ERROR") {
      return { status: "error", fieldErrors: await translateIssues(validationIssues(result.error.details), FIELDS), values };
    }
    return { status: "error", formError: await translateFormError(result.error.code), values };
  }

  revalidatePath("/workspaces");
  redirect(`/workspaces/${result.data.organization.id}`);
}

export type RenameState = FormState<WorkspaceField> & { name?: string; version?: number };

/**
 * Optimistic concurrency (ADR-0007): the form posts the version it rendered.
 * On VERSION_CONFLICT the latest name and version come back so the form shows
 * them and the next save is based on current data.
 */
export async function renameWorkspace(prev: RenameState, formData: FormData): Promise<RenameState> {
  const id = text(formData, "workspaceId");
  const raw = { name: text(formData, "name"), version: text(formData, "version") };
  const parsed = renameWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ...prev,
      status: "error",
      formError: undefined,
      fieldErrors: await translateIssues(parsed.error.issues, FIELDS),
      values: { name: raw.name },
    };
  }

  const result = await authedRequest<OrganizationWithMembership>(`/api/v1/organizations/${id}`, {
    method: "PATCH",
    body: parsed.data,
  });

  if (result.ok) {
    revalidatePath(`/workspaces/${id}`, "layout");
    revalidatePath("/workspaces");
    const t = await getTranslations("workspaces.settings");
    const { name, version } = result.data.organization;
    return { status: "success", formError: t("saved"), name, version };
  }

  if (result.error.code === "VERSION_CONFLICT") {
    const latest = await getWorkspace(id);
    return {
      status: "error",
      formError: await translateFormError("VERSION_CONFLICT"),
      name: latest.organization.name,
      version: latest.organization.version,
    };
  }

  if (result.error.code === "VALIDATION_ERROR") {
    return {
      ...prev,
      status: "error",
      fieldErrors: await translateIssues(validationIssues(result.error.details), FIELDS),
      values: { name: raw.name },
    };
  }

  if (result.error.code === "ORGANIZATION_NOT_FOUND") redirect("/workspaces");

  return { ...prev, status: "error", formError: await translateFormError(result.error.code), values: { name: raw.name } };
}

export async function loadMoreWorkspaces(cursor: string): Promise<WorkspacePage> {
  return listWorkspaces(cursor);
}
