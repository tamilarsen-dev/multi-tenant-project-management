import { Router } from "express";

import * as auth from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

router.post("/register", auth.register);
router.post("/login", auth.login);
// Refresh does its own conditional revoke; running `authenticate` first would hide token reuse.
router.post("/refresh", auth.refresh);
router.post("/logout", authenticate, auth.logout);
router.get("/me", authenticate, auth.me);

export default router;
