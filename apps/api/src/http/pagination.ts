import { z, type ZodType } from "zod";

/**
 * Cursor pagination (ADR-0004). The cursor is base64url JSON of the last row's
 * sort keys. It is validated on input and never widens the query: tenant and
 * authorization filters always come from the current request.
 */

export const paginationQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(512).optional(),
});

export type Page<T> = {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean; totalCount: number };
};

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** Returns the decoded cursor, or `null` when it is malformed (caller reports a validation error). */
export function decodeCursor<T>(cursor: string, schema: ZodType<T>): T | null {
  try {
    const json: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const result = schema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Builds a page from rows fetched with `take: limit + 1`.
 * The extra row only signals that another page exists.
 */
export function buildPage<Row, Item>(
  rows: Row[],
  limit: number,
  totalCount: number,
  toItem: (row: Row) => Item,
  toCursor: (row: Row) => unknown,
): Page<Item> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);

  return {
    data: pageRows.map(toItem),
    pagination: {
      nextCursor: hasMore && last !== undefined ? encodeCursor(toCursor(last)) : null,
      hasMore,
      totalCount,
    },
  };
}
