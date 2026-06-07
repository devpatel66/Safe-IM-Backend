import { Router } from "express";
import { invoiceController } from "../controllers/invoice.controller";
import { asyncHandler } from "../middlewares/asyncHandler";
import { validate } from "../middlewares/validate";
import { can } from "../middlewares/authorize";
import { createInvoiceSchema, updateInvoiceSchema } from "../validators/invoice.validator";

const router = Router();

// ── Read — all roles ─────────────────────────────────────────────────────────
router.get("/",              ...can("invoices:read"), asyncHandler(invoiceController.list));
router.get("/export/excel",  ...can("invoices:read"), asyncHandler(invoiceController.exportExcel));
router.get("/:id",           ...can("invoices:read"), asyncHandler(invoiceController.getById));
router.get("/:id/pdf",       ...can("invoices:read"), asyncHandler(invoiceController.downloadPdf));
router.get("/:id/excel",     ...can("invoices:read"), asyncHandler(invoiceController.exportInvoiceDetailExcel));

// ── Create — admin + staff ───────────────────────────────────────────────────
router.post("/", ...can("invoices:create"), validate(createInvoiceSchema), asyncHandler(invoiceController.create));

// ── Update — admin + staff ───────────────────────────────────────────────────
router.put("/:id", ...can("invoices:update"), validate(updateInvoiceSchema), asyncHandler(invoiceController.update));

// ── Delete — admin only ──────────────────────────────────────────────────────
// This is the most sensitive action — only admin can permanently remove an invoice
router.delete("/:id", ...can("invoices:delete"), asyncHandler(invoiceController.delete));

export default router;