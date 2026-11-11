import { logger } from "../../config/logger.js";
import { runInTransaction, type Tx } from "../../db/transaction.js";
import { AppError } from "../../http/errors.js";
import { toSessionDto, toUserDto } from "./auth.mapper.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { windowForLogin, windowForRefresh, type SessionWindow } from "./identity.rules.js";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password.js";
import * as sessions from "./session.repository.js";
import { generateSessionToken, hashSessionToken } from "./session-token.js";
import * as users from "./user.repository.js";

async function issueSession(userId: string, window: SessionWindow, tx?: Tx) {
  const accessToken = generateSessionToken();
  const session = await sessions.createSession(
    { userId, tokenHash: hashSessionToken(accessToken), ...window },
    tx,
  );
  return toSessionDto(session, accessToken);
}

/** FR-AUTH-001: User and first Session commit together. */
export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);

  return runInTransaction(async (tx) => {
    const user = await users.createUser(
      { email: input.email, passwordHash, displayName: input.displayName },
      tx,
    );
    const session = await issueSession(user.id, windowForLogin(new Date()), tx);
    return { user: toUserDto(user), session };
  });
}

/** FR-AUTH-002: unknown email and wrong password are indistinguishable, including in timing. */
export async function login(input: LoginInput) {
  const user = await users.findUserByEmail(input.email);

  const valid = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await verifyAgainstDummy(input.password);

  if (!user || !valid) {
    throw new AppError("INVALID_CREDENTIALS");
  }

  const session = await issueSession(user.id, windowForLogin(new Date()));
  return { user: toUserDto(user), session };
}

/**
 * FR-AUTH-006: conditional revoke + insert in one transaction. Of concurrent refreshes
 * with one token exactly one wins; reuse of a rotated token is logged, not escalated.
 */
export async function refresh(token: string) {
  const tokenHash = hashSessionToken(token);

  const result = await runInTransaction(async (tx) => {
    const revoked = await sessions.revokeIfActive(tokenHash, tx);
    if (!revoked) return null;

    const session = await issueSession(
      revoked.userId,
      windowForRefresh(new Date(), revoked.absoluteExpiresAt),
      tx,
    );
    const user = await sessions.findUserForAuth(revoked.userId, tx);
    return { user: toUserDto(user), session };
  });

  if (result) return result;

  const existing = await sessions.findSessionByTokenHash(tokenHash);
  if (existing?.revokedAt) {
    logger.warn(
      { event: "session.revoked_token_reuse", sessionId: existing.id, userId: existing.userId },
      "Refresh attempted with a revoked or rotated session token",
    );
  }

  throw new AppError("INVALID_SESSION");
}

/** FR-AUTH-004: revokes only the calling Session. */
export async function logout(sessionId: string) {
  await sessions.revokeSessionById(sessionId);
}
