import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../common/http/app-error.js";

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", {
          details: {
            issues: result.error.issues,
          },
        }),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
