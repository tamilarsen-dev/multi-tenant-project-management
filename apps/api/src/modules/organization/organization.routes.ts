import { Router } from "express";

import { authenticate } from "../identity/auth.middleware.js";
import * as organization from "./organization.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", organization.create);
router.get("/", organization.list);
router.get("/:organizationId", organization.get);
router.patch("/:organizationId", organization.update);

export default router;
