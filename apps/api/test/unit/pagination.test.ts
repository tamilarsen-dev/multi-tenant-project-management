import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildPage, decodeCursor, encodeCursor, paginationQuery } from "../../src/http/pagination.js";

const cursorSchema = z.strictObject({ id: z.string() });

describe("cursor encoding (ADR-0004)", () => {
  it("round-trips", () => {
    expect(decodeCursor(encodeCursor({ id: "abc" }), cursorSchema)).toEqual({ id: "abc" });
  });

  it.each(["not-base64-json", encodeCursor({ other: 1 }), encodeCursor("string")])(
    "returns null for malformed cursor %s",
    (cursor) => {
      expect(decodeCursor(cursor, cursorSchema)).toBeNull();
    },
  );
});

describe("buildPage", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("uses the extra row only to signal another page", () => {
    const page = buildPage(rows, 2, 3, (r) => r.id, (r) => ({ id: r.id }));

    expect(page.data).toEqual(["a", "b"]);
    expect(page.pagination.hasMore).toBe(true);
    expect(decodeCursor(page.pagination.nextCursor!, cursorSchema)).toEqual({ id: "b" });
  });

  it("last page has no cursor", () => {
    const page = buildPage(rows, 5, 3, (r) => r.id, (r) => ({ id: r.id }));

    expect(page.pagination).toEqual({ nextCursor: null, hasMore: false, totalCount: 3 });
  });
});

describe("paginationQuery", () => {
  it("defaults limit to 20", () => {
    expect(paginationQuery.parse({})).toEqual({ limit: 20 });
  });

  it.each([{ limit: "0" }, { limit: "101" }, { limit: "abc" }])("rejects %o", (q) => {
    expect(paginationQuery.safeParse(q).success).toBe(false);
  });
});
