import type { Request, Response } from "express";

import { paginationQuery } from "../../http/pagination.js";
import { parseRequest } from "../../http/validate.js";
import { requireAuth } from "../identity/auth.middleware.js";
import {
  createOrganizationBody,
  organizationParams,
  updateOrganizationBody,
} from "./organization.schema.js";
import * as service from "./organization.service.js";

export async function create(req: Request, res: Response) {
  const { body } = parseRequest(req, { body: createOrganizationBody });
  const data = await service.createOrganization(requireAuth(req).user, body);

  res.status(201).location(`/api/v1/organizations/${data.organization.id}`).json({ data });
}

export async function list(req: Request, res: Response) {
  const { query } = parseRequest(req, { query: paginationQuery });
  res.status(200).json(await service.listOrganizations(requireAuth(req).user, query));
}

export async function get(req: Request, res: Response) {
  const { params } = parseRequest(req, { params: organizationParams });
  res.status(200).json({ data: await service.getOrganization(requireAuth(req).user, params.organizationId) });
}

export async function update(req: Request, res: Response) {
  const { params, body } = parseRequest(req, { params: organizationParams, body: updateOrganizationBody });
  const data = await service.updateOrganization(requireAuth(req).user, params.organizationId, body);

  res.status(200).json({ data });
}
