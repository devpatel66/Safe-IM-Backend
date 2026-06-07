import { Router } from "express";
import { planController } from "../controllers/plan.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { can } from "../middlewares/authorize";
import {
  createPlanSchema, updatePlanSchema,
  createPlanRateSchema, updatePlanRateSchema,
} from "../validators/plan.validator";

const router = Router();

// ── Plans ───────────────────────────────────────────────────────────────────
router.get("/client/:clientId", ...can("plans:read"), asyncHandler(planController.listByClient));
router.get("/:id",              ...can("plans:read"), asyncHandler(planController.getById));

router.post(  "/",    ...can("plans:manage"), validate(createPlanSchema), asyncHandler(planController.create));
router.put(   "/:id", ...can("plans:manage"), validate(updatePlanSchema), asyncHandler(planController.update));
router.delete("/:id", ...can("plans:manage"), asyncHandler(planController.delete));

// ── Plan Rates ───────────────────────────────────────────────────────────────
router.get("/:planId/rates", ...can("plans:read"), asyncHandler(planController.listRatesByPlan));
router.get("/rates/:id",     ...can("plans:read"), asyncHandler(planController.getRateById));

router.post(  "/rates",    ...can("plans:manage"), validate(createPlanRateSchema), asyncHandler(planController.createRate));
router.put(   "/rates/:id", ...can("plans:manage"), validate(updatePlanRateSchema), asyncHandler(planController.updateRate));
router.delete("/rates/:id", ...can("plans:manage"), asyncHandler(planController.deleteRate));

export default router;