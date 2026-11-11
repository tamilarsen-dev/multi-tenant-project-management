import type { Tx } from "../../db/transaction.js";
import type { ActivityEventType, Prisma } from "../../generated/prisma/client.js";

/** Metadata envelope: docs/design/domain-model.md §6.2. Never contains secrets or comment bodies. */
export type ActivityMetadata = {
  schemaVersion: 1;
  entityType: "ORGANIZATION" | "MEMBERSHIP" | "INVITATION" | "PROJECT" | "ISSUE" | "LABEL" | "COMMENT";
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  [extra: string]: unknown;
};

/**
 * Appends one Activity. Takes a transaction on purpose: Activity is always written
 * in the same transaction as the change it records. There is no update or delete.
 */
export function recordActivity(
  tx: Tx,
  activity: {
    organizationId: string;
    actorUserId: string | null;
    eventType: ActivityEventType;
    metadata: ActivityMetadata;
    issueId?: string;
  },
) {
  return tx.activity.create({
    data: { ...activity, metadata: activity.metadata as Prisma.InputJsonObject },
  });
}
