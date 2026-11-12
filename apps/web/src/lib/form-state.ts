/**
 * Maps API and local validation issues to interface messages (design system §3:
 * a message under the field that failed, naming the rule). Pure, so it is
 * unit tested; server actions translate the keys.
 */

export type FieldMessage = { key: string; values?: Record<string, number> };

export type FormState<Field extends string> = {
  status: "idle" | "error" | "success";
  /** Already-translated text for the whole form (role="alert"). */
  formError?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** Echoed back so a failed submit keeps what the user typed (never passwords). */
  values?: Partial<Record<Field, string>>;
};

type Issue = { path: readonly (string | number)[]; code: string };

/** Mirrors the API limits (contract §3–§4, conventions §7.1). */
export const FIELD_MAX: Record<string, number> = {
  email: 254,
  password: 128,
  displayName: 100,
  name: 100,
};

export function messageForIssue(field: string, code: string): FieldMessage {
  switch (code) {
    case "invalid_type":
      return { key: "required" };
    case "too_small":
      return field === "password" ? { key: "passwordMin" } : { key: "required" };
    case "too_big":
      return { key: "tooLong", values: { max: FIELD_MAX[field] ?? 0 } };
    case "invalid_format":
      return field === "email" ? { key: "email" } : { key: "invalid" };
    default:
      return { key: "invalid" };
  }
}

/** First issue per known field wins; issues on unknown paths are ignored. */
export function fieldMessages<Field extends string>(
  issues: readonly Issue[],
  fields: readonly Field[],
): Partial<Record<Field, FieldMessage>> {
  const result: Partial<Record<Field, FieldMessage>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(fields as readonly string[]).includes(field)) continue;
    const key = field as Field;
    result[key] ??= messageForIssue(field, issue.code);
  }
  return result;
}

/** Codes with a specific message in `errors.*`; anything else is shown as UNKNOWN. */
const KNOWN_FORM_ERRORS = new Set([
  "INVALID_CREDENTIALS",
  "EMAIL_ALREADY_EXISTS",
  "RATE_LIMIT_EXCEEDED",
  "FORBIDDEN",
  "VERSION_CONFLICT",
  "API_UNAVAILABLE",
]);

export function formErrorKey(code: string): string {
  return KNOWN_FORM_ERRORS.has(code) ? code : "UNKNOWN";
}
