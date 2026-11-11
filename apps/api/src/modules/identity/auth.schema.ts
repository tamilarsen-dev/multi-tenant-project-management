import { z } from "zod";

import { fields } from "../../http/validate.js";

/** Passwords are never trimmed or normalized (docs/design/security.md §2). */
const password = z.string().min(12).max(128);

export const registerBody = z.strictObject({
  email: fields.email,
  password,
  displayName: fields.displayName,
});

export const loginBody = z.strictObject({
  email: fields.email,
  // Login accepts any non-empty password up to the maximum so old or short
  // passwords fail as INVALID_CREDENTIALS, not as a validation error that leaks policy.
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LoginInput = z.infer<typeof loginBody>;
