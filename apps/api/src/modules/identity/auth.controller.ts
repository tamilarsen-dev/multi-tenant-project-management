import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../common/http/app-error.js";
import { AppSuccess } from "../../common/http/app-success.js";
import { authService } from "./auth.service.js";

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);

      res.status(201).json(
        new AppSuccess({
          user: result.user,
          sessionToken: result.sessionToken,
        }),
      );
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);

      res.status(200).json(
        new AppSuccess({
          user: result.user,
          sessionToken: result.sessionToken,
        }),
      );
    } catch (error) {
      next(error);
    }
  },

  getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("UNAUTHENTICATED");
      }

      return res.status(200).json(
        new AppSuccess({
          user: req.user,
        }),
      );
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.sessionId) {
        throw new AppError("UNAUTHENTICATED");
      }

      await authService.logout(req.sessionId);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
