import express, { Router } from "express";
import { businessProfileController, festivalController } from "../controllers/misc.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { can, role } from "../middlewares/authorize";
import {
  upsertBusinessProfileSchema,
  createFestivalSchema,
  updateFestivalSchema,
} from "../validators/misc.validator";

const router = Router();

// ── Business Profile — admin only ────────────────────────────────────────────
// Using role() here instead of can() because there's no
// granular permission for this — it's simply an admin action.
router.get("/business-profile", ...role("admin"), asyncHandler(businessProfileController.get));
router.put("/business-profile", ...role("admin"), validate(upsertBusinessProfileSchema), asyncHandler(businessProfileController.upsert));

// ── Spreadsheet Imports — admin only ─────────────────────────────────────────
router.post("/import/invoices", ...role("admin"), express.raw({ type: () => true, limit: "10mb" }), asyncHandler(businessProfileController.importInvoices));
router.post("/import/statements", ...role("admin"), express.raw({ type: () => true, limit: "10mb" }), asyncHandler(businessProfileController.importStatements));

// ── Festivals — admin only ───────────────────────────────────────────────────
router.post(  "/festivals",        ...role("admin"), validate(createFestivalSchema), asyncHandler(festivalController.create));
router.get(   "/festivals",        ...role("admin"), asyncHandler(festivalController.list));
router.get(   "/festivals/active", ...role("admin"), asyncHandler(festivalController.getActive));
router.get(   "/festivals/:id",    ...role("admin"), asyncHandler(festivalController.getById));
router.put(   "/festivals/:id",    ...role("admin"), validate(updateFestivalSchema), asyncHandler(festivalController.update));
router.delete("/festivals/:id",    ...role("admin"), asyncHandler(festivalController.delete));

export default router;