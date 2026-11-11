import { db as defaultDb, type Db, type Tx } from "../../db/transaction.js";
import { membershipInclude } from "../membership/membership.repository.js";

export function createOrganization(data: { name: string }, tx: Tx) {
  return tx.organization.create({ data });
}

export function findOrganizationById(id: string, db: Db = defaultDb) {
  return db.organization.findUnique({ where: { id } });
}

export type OrganizationCursor = { createdAt: string; id: string };

/** Organizations where the user has an ACTIVE Membership, newest first (contract §4.2). */
export function listOrganizationsForUser(
  userId: string,
  page: { limit: number; after?: OrganizationCursor },
  db: Db = defaultDb,
) {
  const after = page.after;

  return db.membership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      ...(after && {
        OR: [
          { organization: { createdAt: { lt: new Date(after.createdAt) } } },
          { organization: { createdAt: new Date(after.createdAt), id: { lt: after.id } } },
        ],
      }),
    },
    include: { ...membershipInclude, organization: true },
    orderBy: [{ organization: { createdAt: "desc" } }, { organization: { id: "desc" } }],
    take: page.limit + 1,
  });
}

export function countOrganizationsForUser(userId: string, db: Db = defaultDb) {
  return db.membership.count({ where: { userId, status: "ACTIVE" } });
}

/** Conditional update (ADR-0007). Returns false when `expectedVersion` is stale. */
export async function renameIfVersion(
  id: string,
  expectedVersion: number,
  name: string,
  tx: Tx,
): Promise<boolean> {
  const { count } = await tx.organization.updateMany({
    where: { id, version: expectedVersion },
    data: { name, version: { increment: 1 } },
  });
  return count === 1;
}
