import { Request, Response } from "express";
import { statementService } from "../services/statement.service";
import { pdfService } from "../services/pdf.service";

export const statementController = {
  async create(req: Request, res: Response) {
    const statement = await statementService.create(req.body);
    res.status(201).json({ success: true, data: statement });
  },

  async getById(req: Request, res: Response) {
    const statement = await statementService.getById(Number(req.params.id));
    if (!statement) return res.status(404).json({ success: false, message: "Statement not found" });
    res.json({ success: true, data: statement });
  },

  async listByClient(req: Request, res: Response) {
    const statements = await statementService.listByClient(Number(req.params.clientId));
    res.json({ success: true, data: statements });
  },

  async update(req: Request, res: Response) {
    const updated = await statementService.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Statement not found" });
    res.json({ success: true, data: updated });
  },

  async delete(req: Request, res: Response) {
    const deleted = await statementService.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Statement not found" });
    res.json({ success: true, data: deleted });
  },

  async downloadPdf(req: Request, res: Response) {
    const id = Number(req.params.id);
    const title = req.query.title ? String(req.query.title) : undefined;
    const pdfBytes = await pdfService.generateStatementPdf(id, title);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${id}.pdf"`,
    });
    res.send(Buffer.from(pdfBytes));
  },
};
