import type { Request } from "express";
import { z, type ZodType } from "zod";

import { AppError } from "./errors.js";

type Schemas = {
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
};

type Parsed<S extends Schemas> = {
  [K in keyof S]: S[K] extends ZodType ? z.output<S[K]> : never;
};

type FieldIssue = { path: (string | number)[]; code: string; message: string };

/**
 * Validates the parts of a request the endpoint uses and returns typed values.
 * Called at the top of every controller, so a use case never sees unvalidated input.
 * Issues from all parts are reported together; params and query paths are prefixed
 * with "params" / "query" (docs/design/api/errors.md §1).
 */
export function parseRequest<S extends Schemas>(req: Request, schemas: S): Parsed<S> {
  const output: Record<string, unknown> = {};
  const fields: FieldIssue[] = [];

  for (const part of ["params", "query", "body"] as const) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(part === "body" ? (req.body ?? {}) : req[part]);

    if (result.success) {
      output[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        fields.push({
          path: part === "body" ? issue.path.map(toPathSegment) : [part, ...issue.path.map(toPathSegment)],
          code: issue.code,
          message: issue.message,
        });
      }
    }
  }

  if (fields.length > 0) {
    throw new AppError("VALIDATION_ERROR", { details: { fields } });
  }

  return output as Parsed<S>;
}

function toPathSegment(segment: PropertyKey): string | number {
  return typeof segment === "number" ? segment : String(segment);
}

/** Reusable field schemas. Limits come from docs/design/api/conventions.md §7.1. */
export const fields = {
  uuid: z.uuid(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  displayName: z.string().trim().min(1).max(100),
  version: z.number().int().positive(),
};
