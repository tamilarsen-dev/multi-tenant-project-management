import { z } from "zod";

/**
 * Same rules as the API's request schemas, checked before the round trip so
 * obvious mistakes get instant feedback. The API stays the authority.
 */
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const name = z.string().trim().min(1).max(100);

export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const createAccountSchema = z.object({
  displayName: name,
  email,
  password: z.string().min(12).max(128),
});

export const workspaceNameSchema = z.object({ name });

export const renameWorkspaceSchema = z.object({
  name,
  version: z.coerce.number().int().positive(),
});
