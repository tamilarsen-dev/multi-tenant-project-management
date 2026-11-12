"use server";

import { redirect } from "next/navigation";

import type { AuthResponse } from "@/lib/api/types";
import type { FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/session-cookie";
import { apiRequest } from "@/lib/server/api";
import { text, translateFormError, translateIssues } from "@/lib/server/form";
import { clearSession, readSessionToken, storeSession } from "@/lib/server/session";
import { createAccountSchema, signInSchema } from "@/lib/validation";

export type SignInField = "email" | "password";
export type CreateAccountField = "displayName" | "email" | "password";

const SIGN_IN_FIELDS = ["email", "password"] as const;
const CREATE_ACCOUNT_FIELDS = ["displayName", "email", "password"] as const;

export async function signIn(_prev: FormState<SignInField>, formData: FormData): Promise<FormState<SignInField>> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const values = { email: raw.email };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: await translateIssues(parsed.error.issues, SIGN_IN_FIELDS), values };
  }

  const result = await apiRequest<AuthResponse>("/api/v1/auth/login", { method: "POST", body: parsed.data });
  if (!result.ok) {
    if (result.error.code === "VALIDATION_ERROR") {
      const issues = result.error.details && "fields" in result.error.details ? result.error.details.fields : [];
      return { status: "error", fieldErrors: await translateIssues(issues, SIGN_IN_FIELDS), values };
    }
    return { status: "error", formError: await translateFormError(result.error.code), values };
  }

  await storeSession(result.data.session);
  redirect(safeNextPath(formData.get("next")));
}

export async function createAccount(
  _prev: FormState<CreateAccountField>,
  formData: FormData,
): Promise<FormState<CreateAccountField>> {
  const raw = {
    displayName: text(formData, "displayName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const values = { displayName: raw.displayName, email: raw.email };

  const parsed = createAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: await translateIssues(parsed.error.issues, CREATE_ACCOUNT_FIELDS), values };
  }

  const result = await apiRequest<AuthResponse>("/api/v1/auth/register", { method: "POST", body: parsed.data });
  if (!result.ok) {
    if (result.error.code === "VALIDATION_ERROR") {
      const issues = result.error.details && "fields" in result.error.details ? result.error.details.fields : [];
      return { status: "error", fieldErrors: await translateIssues(issues, CREATE_ACCOUNT_FIELDS), values };
    }
    return { status: "error", formError: await translateFormError(result.error.code), values };
  }

  await storeSession(result.data.session);
  redirect("/workspaces/new");
}

/** Revokes the session at the API, then clears the cookie even if the API call failed. */
export async function signOut(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await apiRequest("/api/v1/auth/logout", { method: "POST", token });
  }
  await clearSession();
  redirect("/sign-in");
}
