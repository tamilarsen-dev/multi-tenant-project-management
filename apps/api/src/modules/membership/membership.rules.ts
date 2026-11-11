/**
 * Domain vocabulary, independent of Prisma (architecture.md §7.2). The database
 * enums mirror these unions; a drift fails typecheck in the repository, where
 * Prisma rows are assigned to these types.
 */
export type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";
export type MembershipStatus = "ACTIVE" | "REMOVED";

/** docs/design/permissions.md §2.1 */
export function canUpdateOrganization(role: OrganizationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
