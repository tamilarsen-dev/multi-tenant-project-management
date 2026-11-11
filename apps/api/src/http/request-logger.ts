import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";

import { logger } from "../config/logger.js";

const CLIENT_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Reuses a well-formed client `X-Request-Id`, otherwise generates a UUID, and
 * echoes it in the response header so a client report can be matched to a log line.
 */
export function assignRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && CLIENT_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.setHeader("X-Request-Id", id);
  return id;
}

function pathOnly(url: string | undefined): string | undefined {
  return url?.split("?")[0];
}

/** One structured log line per request (docs/design/api/conventions.md §13). */
export const requestLogger = pinoHttp({
  logger,
  genReqId: assignRequestId,
  customProps: (req) => ({ requestId: req.id, userId: (req as { auth?: { user: { id: string } } }).auth?.user.id }),
  serializers: {
    req: (req: { method: string; url: string }) => ({ method: req.method, route: pathOnly(req.url) }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
