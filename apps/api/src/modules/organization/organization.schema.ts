import { z } from "zod";

import { fields } from "../../http/validate.js";

const name = z.string().trim().min(1).max(100);

export const organizationParams = z.strictObject({ organizationId: fields.uuid });

export const createOrganizationBody = z.strictObject({ name });

export const updateOrganizationBody = z.strictObject({ name, version: fields.version });

export const organizationCursor = z.strictObject({ createdAt: z.iso.datetime(), id: fields.uuid });

export type CreateOrganizationInput = z.infer<typeof createOrganizationBody>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationBody>;
