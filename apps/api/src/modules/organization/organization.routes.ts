import { Router } from "express";
import { authenticate } from "../identity/auth.middleware.js";
import { validate } from "../../middleware/validate.js";
import { createOrganizationSchema } from "./organization.schema.js";
import { organizationController } from "./organization.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  validate(createOrganizationSchema),
  organizationController.create,
);

export default router;
