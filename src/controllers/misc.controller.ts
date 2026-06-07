import { Request, Response } from "express";
import { businessProfileService } from "../services/businessProfile.service";
import { festivalService } from "../services/festival.service";
import { excelService } from "../services/excel.service";

export const businessProfileController = {
  async get(req: Request, res: Response) {
    const profile = await businessProfileService.get();
    if (!profile) return res.status(404).json({ success: false, message: "Profile not set up yet" });
    res.json({ success: true, data: profile });
  },

  async upsert(req: Request, res: Response) {
    const profile = await businessProfileService.upsert(req.body);
    res.json({ success: true, data: profile });
  },

  async importInvoices(req: Request, res: Response) {
    if (!req.body || !(req.body instanceof Buffer)) {
      return res.status(400).json({ success: false, message: "Invalid or empty spreadsheet buffer" });
    }
    const result = await excelService.importInvoices(req.body);
    res.json({ success: true, data: result });
  },

  async importStatements(req: Request, res: Response) {
    if (!req.body || !(req.body instanceof Buffer)) {
      return res.status(400).json({ success: false, message: "Invalid or empty spreadsheet buffer" });
    }
    const result = await excelService.importStatements(req.body);
    res.json({ success: true, data: result });
  },
};

export const festivalController = {
  async create(req: Request, res: Response) {
    const festival = await festivalService.create(req.body);
    res.status(201).json({ success: true, data: festival });
  },

  async getById(req: Request, res: Response) {
    const festival = await festivalService.getById(Number(req.params.id));
    if (!festival) return res.status(404).json({ success: false, message: "Festival not found" });
    res.json({ success: true, data: festival });
  },

  async list(req: Request, res: Response) {
    const festivals = await festivalService.list();
    res.json({ success: true, data: festivals });
  },

  async getActive(req: Request, res: Response) {
    const festivals = await festivalService.getActive();
    res.json({ success: true, data: festivals });
  },

  async update(req: Request, res: Response) {
    const updated = await festivalService.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Festival not found" });
    res.json({ success: true, data: updated });
  },

  async delete(req: Request, res: Response) {
    const deleted = await festivalService.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Festival not found" });
    res.json({ success: true, data: deleted });
  },
};
