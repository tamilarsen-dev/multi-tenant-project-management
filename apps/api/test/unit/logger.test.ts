import pino from "pino";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { loggerOptions } from "../../src/config/logger.js";

describe("Logger sensitive data redaction", () => {
  it("redacts sensitive fields from structured logs", () => {
    const chunks: string[] = [];

    const destination = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });

    const testLogger = pino(
      {
        ...loggerOptions,
        level: "debug",
        transport: undefined,
      },
      destination,
    );

    testLogger.info(
      {
        password: "secret-password",
        passwordHash: "secret-hash",
        sessionToken: "secret-session-token",
        user: {
          token: "nested-secret-token",
        },
        authorization: "Bearer secret-token",
        cookie: "session=secret-cookie",
      },
      "Sensitive data test",
    );

    const output = chunks.join("");

    expect(output).toContain("[REDACTED]");

    expect(output).not.toContain("secret-password");
    expect(output).not.toContain("secret-hash");
    expect(output).not.toContain("secret-session-token");
    expect(output).not.toContain("nested-secret-token");
    expect(output).not.toContain("Bearer secret-token");
    expect(output).not.toContain("secret-cookie");
  });
});
