import { db as defaultDb, type Db } from "../../db/transaction.js";
import type { OrganizationRole } from "../../generated/prisma/client.js";

export const membershipInclude = {
  user: { select: { id: true, email: true, displayName: true } },
} as const;

/** The caller's ACTIVE Membership in an Organization, or null. Tenant-scoped by both keys. */
export function findActiveMembership(organizationId: string, userId: string, db: Db = defaultDb) {
  return db.membership.findFirst({
    where: { organizationId, userId, status: "ACTIVE" },
    include: membershipInclude,
  });
}

export function createMembership(
  data: { organizationId: string; userId: string; role: OrganizationRole },
  db: Db = defaultDb,
) {
  return db.membership.create({ data, include: membershipInclude });
}
