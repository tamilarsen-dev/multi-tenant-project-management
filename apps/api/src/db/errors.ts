import { Prisma } from "../generated/prisma/client.js";

/**
 * True when `error` is a unique-constraint violation on `constraint`.
 * Prisma reports the violated fields or index name depending on the adapter,
 * so both the constraint name and the field list are checked.
 */
export function isUniqueViolation(
  error: unknown,
  match: { constraint: string; fields: readonly string[] },
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const text = JSON.stringify(error.meta ?? {});

  return (
    text.includes(match.constraint) ||
    match.fields.every((field) => text.includes(field))
  );
}
