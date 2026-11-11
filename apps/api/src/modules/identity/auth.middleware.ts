import type { Request, RequestHandler } from "express";

import { AppError } from "../../http/errors.js";
import { findActiveSessionByTokenHash } from "./session.repository.js";
import { hashSessionToken } from "./session-token.js";

/** Extracts the token from `Authorization: Bearer <token>`; MISSING_AUTHENTICATION otherwise. */
export function readBearerToken(req: Request): string {
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/);

  if (!match?.[1]) {
    throw new AppError("MISSING_AUTHENTICATION");
  }
  return match[1];
}

/** Establishes `req.auth` from a valid Session. Identity never comes from request fields. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readBearerToken(req);
  const session = await findActiveSessionByTokenHash(hashSessionToken(token));

  if (!session) {
    throw new AppError("INVALID_SESSION");
  }

  req.auth = { user: session.user, sessionId: session.id };
  next();
};

/** For handlers behind `authenticate`; narrows `req.auth` without a non-null assertion. */
export function requireAuth(req: Request): Express.AuthContext {
  if (!req.auth) {
    throw new AppError("MISSING_AUTHENTICATION");
  }
  return req.auth;
}
