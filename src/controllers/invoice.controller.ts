import { Request, Response } from "express";
import { invoiceService } from "../services/invoice.service";
import { invoiceListQuerySchema } from "../validators/invoice.validator";
import { pdfService } from "../services/pdf.service";
import { excelService } from "../services/excel.service";

export const invoiceController = {
  async create(req: Request, res: Response) {
    const invoice = await invoiceService.create(req.body);
    res.status(201).json({ success: true, data: invoice });
  },

  async getById(req: Request, res: Response) {
    const invoice = await invoiceService.getById(Number(req.params.id));
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
  },

  async list(req: Request, res: Response) {
    const parsed = invoiceListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.issues });
    }
    const result = await invoiceService.list(parsed.data);
    res.json({ success: true, ...result });
  },

  async update(req: Request, res: Response) {
    const updated = await invoiceService.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: updated });
  },

  async delete(req: Request, res: Response) {
    const deleted = await invoiceService.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: deleted });
  },

  async downloadPdf(req: Request, res: Response) {
    const id = Number(req.params.id);
    const pdfBytes = await pdfService.generateInvoicePdf(id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
    });
    res.send(Buffer.from(pdfBytes));
  },

  async exportExcel(req: Request, res: Response) {
    const parsed = invoiceListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.issues });
    }
    const buffer = await excelService.exportInvoices(parsed.data);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoices-export.xlsx"`,
    });
    res.send(buffer);
  },

  async exportInvoiceDetailExcel(req: Request, res: Response) {
    const id = Number(req.params.id);
    const buffer = await excelService.exportInvoiceDetail(id);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="invoice-${id}-detail.xlsx"`,
    });
    res.send(buffer);
  },
};
