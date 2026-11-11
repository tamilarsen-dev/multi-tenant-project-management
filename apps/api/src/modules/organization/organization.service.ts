import { runInTransaction, type Db } from "../../db/transaction.js";
import { AppError } from "../../http/errors.js";
import { buildPage, decodeCursor } from "../../http/pagination.js";
import { recordActivity } from "../activity/activity.repository.js";
import { toMembershipDto } from "../membership/membership.mapper.js";
import { createMembership, findActiveMembership } from "../membership/membership.repository.js";
import { canUpdateOrganization } from "../membership/membership.rules.js";
import { toOrganizationDto } from "./organization.mapper.js";
import * as organizations from "./organization.repository.js";
import {
  organizationCursor,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "./organization.schema.js";

type Actor = { id: string };

/**
 * Resolves the actor's ACTIVE Membership. A missing Organization and one the actor
 * cannot see produce the same 404 (docs/design/api/conventions.md §6.2).
 */
async function requireMembership(organizationId: string, actor: Actor, db?: Db) {
  const membership = await findActiveMembership(organizationId, actor.id, db);
  if (!membership) {
    throw new AppError("ORGANIZATION_NOT_FOUND");
  }
  return membership;
}

/** FR-ORG-001: Organization, OWNER Membership, and Activity commit together. */
export function createOrganization(actor: Actor, input: CreateOrganizationInput) {
  return runInTransaction(async (tx) => {
    const organization = await organizations.createOrganization({ name: input.name }, tx);
    const membership = await createMembership(
      { organizationId: organization.id, userId: actor.id, role: "OWNER" },
      tx,
    );

    await recordActivity(tx, {
      organizationId: organization.id,
      actorUserId: actor.id,
      eventType: "ORGANIZATION_CREATED",
      metadata: {
        schemaVersion: 1,
        entityType: "ORGANIZATION",
        entityId: organization.id,
        changes: { name: { from: null, to: organization.name } },
        ownerMembershipId: membership.id,
      },
    });

    return { organization: toOrganizationDto(organization), membership: toMembershipDto(membership) };
  });
}

/** FR-ORG-002 */
export async function listOrganizations(actor: Actor, page: { limit: number; cursor?: string }) {
  const after = page.cursor ? decodeCursor(page.cursor, organizationCursor) : undefined;

  if (after === null) {
    throw new AppError("VALIDATION_ERROR", {
      details: { fields: [{ path: ["query", "cursor"], code: "invalid_format", message: "Invalid cursor" }] },
    });
  }

  const [rows, totalCount] = await Promise.all([
    organizations.listOrganizationsForUser(actor.id, { limit: page.limit, after }),
    organizations.countOrganizationsForUser(actor.id),
  ]);

  return buildPage(
    rows,
    page.limit,
    totalCount,
    (row) => ({ organization: toOrganizationDto(row.organization), membership: toMembershipDto(row) }),
    (row) => ({ createdAt: row.organization.createdAt.toISOString(), id: row.organization.id }),
  );
}

/** FR-ORG-003 */
export async function getOrganization(actor: Actor, organizationId: string) {
  const membership = await requireMembership(organizationId, actor);
  const organization = await organizations.findOrganizationById(organizationId);

  if (!organization) {
    throw new AppError("ORGANIZATION_NOT_FOUND");
  }

  return { organization: toOrganizationDto(organization), membership: toMembershipDto(membership) };
}

/**
 * FR-ORG-004. A no-op is detected before the version check so a retried request
 * succeeds; a real change uses a conditional update and records ORGANIZATION_UPDATED.
 */
export function updateOrganization(actor: Actor, organizationId: string, input: UpdateOrganizationInput) {
  return runInTransaction(async (tx) => {
    const membership = await requireMembership(organizationId, actor, tx);

    if (!canUpdateOrganization(membership.role)) {
      throw new AppError("FORBIDDEN");
    }

    const current = await organizations.findOrganizationById(organizationId, tx);
    if (!current) {
      throw new AppError("ORGANIZATION_NOT_FOUND");
    }

    if (current.name === input.name) {
      return { organization: toOrganizationDto(current) };
    }

    const updated = await organizations.renameIfVersion(organizationId, input.version, input.name, tx);
    if (!updated) {
      const latest = await organizations.findOrganizationById(organizationId, tx);
      throw new AppError("VERSION_CONFLICT", { details: { currentVersion: latest?.version ?? current.version } });
    }

    await recordActivity(tx, {
      organizationId,
      actorUserId: actor.id,
      eventType: "ORGANIZATION_UPDATED",
      metadata: {
        schemaVersion: 1,
        entityType: "ORGANIZATION",
        entityId: organizationId,
        changes: { name: { from: current.name, to: input.name } },
      },
    });

    const result = await organizations.findOrganizationById(organizationId, tx);
    return { organization: toOrganizationDto(result ?? current) };
  });
}
