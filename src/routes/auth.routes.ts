import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { authenticate } from "../middlewares/authenticate";
import { registerSchema, loginSchema } from "../validators/auth.validator";

const router = Router();

// ── Public — no token needed ────────────────────────────────────────────────
router.post("/register", validate(registerSchema), asyncHandler(authController.register));
router.post("/login",    validate(loginSchema),    asyncHandler(authController.login));

// ── Protected — must be logged in, any role ─────────────────────────────────
// authenticate alone is enough here — no role check needed.
// Any logged-in user should be able to see their own profile.
router.get("/me", authenticate, asyncHandler(authController.me));

export default router;