import type { MembershipStatus, OrganizationRole } from "./membership.rules.js";

type MembershipRow = {
  id: string;
  organizationId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  version: number;
  joinedAt: Date;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; email: string; displayName: string };
};

/** docs/design/api/contract.md §2.4 */
export function toMembershipDto(m: MembershipRow) {
  return {
    id: m.id,
    organizationId: m.organizationId,
    user: { id: m.user.id, email: m.user.email, displayName: m.user.displayName },
    role: m.role,
    status: m.status,
    version: m.version,
    joinedAt: m.joinedAt.toISOString(),
    removedAt: m.removedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
