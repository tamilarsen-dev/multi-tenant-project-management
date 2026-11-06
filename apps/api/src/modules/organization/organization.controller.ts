import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../common/http/app-error.js";
import { AppSuccess } from "../../common/http/app-success.js";
import { organizationService } from "./organization.service.js";

export const organizationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHENTICATED");
      }

      const organization = await organizationService.create(
        req.user.id,
        req.body,
      );

      return res.status(201).json(
        new AppSuccess({
          organization,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
};
