import { Router } from "express";
import { authController } from "./auth.controller.js";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", authenticate, authController.getMe);
router.post("/logout", authenticate, authController.logout);

export default router;
