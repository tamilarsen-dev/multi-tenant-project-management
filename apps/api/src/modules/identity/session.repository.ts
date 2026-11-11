import { db as defaultDb, type Db } from "../../db/transaction.js";

const authUserSelect = { id: true, email: true, displayName: true, createdAt: true } as const;

export function createSession(
  data: { userId: string; tokenHash: string; expiresAt: Date; absoluteExpiresAt: Date },
  db: Db = defaultDb,
) {
  return db.session.create({ data });
}

/** A Session usable for authentication: not revoked and not expired, checked by the query itself. */
export function findActiveSessionByTokenHash(tokenHash: string, db: Db = defaultDb) {
  return db.session.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, user: { select: authUserSelect } },
  });
}

export function findSessionByTokenHash(tokenHash: string, db: Db = defaultDb) {
  return db.session.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });
}

/**
 * Revokes a still-valid Session in one conditional statement. Exactly one of several
 * concurrent callers gets a row back (docs/design/database.md §5.2).
 */
export async function revokeIfActive(tokenHash: string, db: Db) {
  const rows = await db.$queryRaw<{ id: string; user_id: string; absolute_expires_at: Date }[]>`
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    RETURNING id, user_id, absolute_expires_at
  `;
  const row = rows[0];
  return row ? { id: row.id, userId: row.user_id, absoluteExpiresAt: row.absolute_expires_at } : null;
}

export function revokeSessionById(sessionId: string, db: Db = defaultDb) {
  return db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function findUserForAuth(userId: string, db: Db = defaultDb) {
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: authUserSelect });
}
