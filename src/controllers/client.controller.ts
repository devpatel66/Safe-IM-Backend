import { Request, Response } from "express";
import { clientService } from "../services/client.service";

export const clientController = {
  async create(req: Request, res: Response) {
    const client = await clientService.create(req.body);
    res.status(201).json({ success: true, data: client });
  },

  async getById(req: Request, res: Response) {
    const client = await clientService.getById(Number(req.params.id));
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, data: client });
  },

  async list(req: Request, res: Response) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const search = req.query.search as string | undefined;
    const result = await clientService.list(page, limit, search);
    res.json({ success: true, ...result });
  },

  async update(req: Request, res: Response) {
    const updated = await clientService.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, data: updated });
  },

  async delete(req: Request, res: Response) {
    const deleted = await clientService.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Client not found" });
    res.json({ success: true, data: deleted });
  },
};
