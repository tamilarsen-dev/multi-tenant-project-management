import type { Request, Response } from "express";

import { parseRequest } from "../../http/validate.js";
import { toUserDto } from "./auth.mapper.js";
import { readBearerToken, requireAuth } from "./auth.middleware.js";
import { loginBody, registerBody } from "./auth.schema.js";
import * as authService from "./auth.service.js";

export async function register(req: Request, res: Response) {
  const { body } = parseRequest(req, { body: registerBody });
  res.status(201).json({ data: await authService.register(body) });
}

export async function login(req: Request, res: Response) {
  const { body } = parseRequest(req, { body: loginBody });
  res.status(200).json({ data: await authService.login(body) });
}

export async function refresh(req: Request, res: Response) {
  res.status(200).json({ data: await authService.refresh(readBearerToken(req)) });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(requireAuth(req).sessionId);
  res.status(204).send();
}

export function me(req: Request, res: Response) {
  res.status(200).json({ data: { user: toUserDto(requireAuth(req).user) } });
}
