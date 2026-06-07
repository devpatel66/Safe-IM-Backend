import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { role } from "../middlewares/authorize";
import { updateRoleSchema, setActiveSchema } from "../validators/user.validator";

const router = Router();

// All user management is admin-only
router.get(   "/",           ...role("admin"), asyncHandler(userController.list));
router.get(   "/:id",        ...role("admin"), asyncHandler(userController.getById));
router.patch( "/:id/role",   ...role("admin"), validate(updateRoleSchema), asyncHandler(userController.updateRole));
router.patch( "/:id/active", ...role("admin"), validate(setActiveSchema),  asyncHandler(userController.setActive));

export default router;