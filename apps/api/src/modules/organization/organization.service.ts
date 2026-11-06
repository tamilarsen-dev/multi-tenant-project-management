import { prisma } from "../../config/prisma.js";
import { organizationRepository } from "./organization.repository.js";
import type { CreateOrganizationInput } from "./organization.schema.js";

export const organizationService = {
  async create(userId: string, input: CreateOrganizationInput) {
    return prisma.$transaction(async (tx) => {
      const organization = await organizationRepository.create(
        {
          name: input.name,
        },
        tx,
      );

      await organizationRepository.createMembership(
        {
          organizationId: organization.id,
          userId,
          role: "OWNER",
        },
        tx,
      );

      return organization;
    });
  },
};
