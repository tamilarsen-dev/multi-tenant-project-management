import "server-only";
import { getTranslations } from "next-intl/server";

import { fieldMessages, formErrorKey } from "@/lib/form-state";

type Issue = { path: readonly PropertyKey[]; code: string };

export async function translateIssues<Field extends string>(
  issues: readonly Issue[],
  fields: readonly Field[],
): Promise<Partial<Record<Field, string>>> {
  const t = await getTranslations("errors.field");
  const normalized = issues.map((i) => ({
    code: i.code,
    path: i.path.map((p) => (typeof p === "number" ? p : String(p))),
  }));
  const messages = fieldMessages(normalized, fields);
  const result: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const message = messages[field];
    if (message) result[field] = t(message.key, message.values);
  }
  return result;
}

export async function translateFormError(code: string): Promise<string> {
  const t = await getTranslations("errors");
  return t(formErrorKey(code));
}

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
