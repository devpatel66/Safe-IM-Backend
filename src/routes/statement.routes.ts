import { Router } from "express";
import { statementController } from "../controllers/statement.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { can } from "../middlewares/authorize";
import { createStatementSchema, updateStatementSchema } from "../validators/statement.validator";

const router = Router();

// ── Read — all roles ─────────────────────────────────────────────────────────
router.get("/client/:clientId", ...can("statements:read"), asyncHandler(statementController.listByClient));
router.get("/:id",              ...can("statements:read"), asyncHandler(statementController.getById));
router.get("/:id/pdf",          ...can("statements:read"), asyncHandler(statementController.downloadPdf));

// ── Write — admin + staff ────────────────────────────────────────────────────
router.post(  "/",    ...can("statements:create"), validate(createStatementSchema), asyncHandler(statementController.create));
router.put(   "/:id", ...can("statements:update"), validate(updateStatementSchema), asyncHandler(statementController.update));
router.delete("/:id", ...can("statements:delete"), asyncHandler(statementController.delete));

export default router;