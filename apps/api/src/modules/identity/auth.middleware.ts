import type { RequestHandler } from "express";
import { AppError } from "../../common/http/app-error.js";
import { sessionRepository } from "./session.repository.js";
import { hashSessionToken } from "./session-token.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHENTICATED");
    }

    const token = authorization.slice(7);

    if (!token) {
      throw new AppError("UNAUTHENTICATED");
    }

    const tokenHash = hashSessionToken(token);

    const session = await sessionRepository.findActiveByTokenHash(tokenHash);

    if (!session) {
      throw new AppError("UNAUTHENTICATED");
    }

    req.user = session.user;
    req.sessionId = session.id;

    next();
  } catch (error) {
    next(error);
  }
};
