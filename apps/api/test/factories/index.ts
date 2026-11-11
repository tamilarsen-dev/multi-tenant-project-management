import argon2 from "argon2";

import { prisma } from "../../src/db/client.js";
import type { MembershipStatus, OrganizationRole } from "../../src/generated/prisma/client.js";
import { generateSessionToken, hashSessionToken } from "../../src/modules/identity/session-token.js";

const DAY = 24 * 60 * 60 * 1000;
let sequence = 0;

export const DEFAULT_PASSWORD = "correct horse battery staple";

/** Hash once per test run: Argon2 is deliberately slow. */
let defaultHash: Promise<string> | undefined;

export async function createUser(overrides: { email?: string; displayName?: string; password?: string } = {}) {
  sequence += 1;
  const passwordHash = overrides.password
    ? await argon2.hash(overrides.password, { type: argon2.argon2id })
    : await (defaultHash ??= argon2.hash(DEFAULT_PASSWORD, { type: argon2.argon2id }));

  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${sequence}@example.com`,
      displayName: overrides.displayName ?? `User ${sequence}`,
      passwordHash,
    },
  });
}

/** Returns the raw token. Defaults to a fresh, valid session. */
export async function createSession(
  userId: string,
  options: { createdAt?: Date; expiresAt?: Date; absoluteExpiresAt?: Date; revokedAt?: Date | null } = {},
) {
  const now = Date.now();
  const createdAt = options.createdAt ?? new Date(now);
  const absoluteExpiresAt = options.absoluteExpiresAt ?? new Date(createdAt.getTime() + 30 * DAY);
  const expiresAt = options.expiresAt ?? new Date(Math.min(createdAt.getTime() + 7 * DAY, absoluteExpiresAt.getTime()));
  const token = generateSessionToken();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      createdAt,
      expiresAt,
      absoluteExpiresAt,
      revokedAt: options.revokedAt ?? null,
    },
  });

  return { token, session };
}

/** A user with a valid session, ready to call the API. */
export async function createActor(overrides: { email?: string; displayName?: string } = {}) {
  const user = await createUser(overrides);
  const { token } = await createSession(user.id);
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createOrganization(ownerId: string, name = `Org ${++sequence}`) {
  const organization = await prisma.organization.create({ data: { name } });
  const membership = await createMembership(organization.id, ownerId, "OWNER");
  return { organization, membership };
}

export function createMembership(
  organizationId: string,
  userId: string,
  role: OrganizationRole,
  status: MembershipStatus = "ACTIVE",
) {
  return prisma.membership.create({
    data: {
      organizationId,
      userId,
      role,
      status,
      removedAt: status === "REMOVED" ? new Date() : null,
    },
  });
}
