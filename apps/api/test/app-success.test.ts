import { describe, expect, it } from "vitest";

import {
  AppSuccess,
  type PaginationMeta,
} from "../src/common/http/app-success.js";

describe("AppSuccess", () => {
  it("creates a single-resource response", () => {
    const response = new AppSuccess({
      id: "user-uuid",
      email: "user@example.com",
    });

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      data: {
        id: "user-uuid",
        email: "user@example.com",
      },
    });
  });

  it("creates a collection response without metadata", () => {
    const response = new AppSuccess([]);

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      data: [],
    });
  });

  it("creates a collection response with pagination metadata", () => {
    const meta: PaginationMeta = {
      nextCursor: "opaque_cursor",
      hasMore: true,
    };

    const response = new AppSuccess([], { meta });

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      data: [],
      meta: {
        nextCursor: "opaque_cursor",
        hasMore: true,
      },
    });
  });

  it("omits metadata when it is undefined", () => {
    const response = new AppSuccess([], {
      meta: undefined,
    });

    expect(JSON.parse(JSON.stringify(response))).toEqual({
      data: [],
    });
  });
});
