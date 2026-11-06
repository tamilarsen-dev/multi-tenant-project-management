import { prisma } from "../../config/prisma.js";

type OrganizationDbClient = Pick<typeof prisma, "organization" | "membership">;

export const organizationRepository = {
  create(
    data: {
      name: string;
    },
    db: OrganizationDbClient = prisma,
  ) {
    return db.organization.create({
      data,
    });
  },

  createMembership(
    data: {
      organizationId: string;
      userId: string;
      role: "OWNER" | "ADMIN" | "MEMBER";
    },
    db: OrganizationDbClient = prisma,
  ) {
    return db.membership.create({
      data,
    });
  },
};
