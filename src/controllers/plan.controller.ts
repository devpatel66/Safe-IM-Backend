import { Request, Response } from "express";
import { planService } from "../services/plan.service";

export const planController = {
  // ── Plans ──────────────────────────────────────────────────────────────────

  async create(req: Request, res: Response) {
    const plan = await planService.create(req.body);
    res.status(201).json({ success: true, data: plan });
  },

  async getById(req: Request, res: Response) {
    const plan = await planService.getById(Number(req.params.id));
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: plan });
  },

  async listByClient(req: Request, res: Response) {
    const plans = await planService.listByClient(Number(req.params.clientId));
    res.json({ success: true, data: plans });
  },

  async update(req: Request, res: Response) {
    const updated = await planService.update(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: updated });
  },

  async delete(req: Request, res: Response) {
    const deleted = await planService.delete(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Plan not found" });
    res.json({ success: true, data: deleted });
  },

  // ── Plan Rates ─────────────────────────────────────────────────────────────

  async createRate(req: Request, res: Response) {
    const rate = await planService.createRate(req.body);
    res.status(201).json({ success: true, data: rate });
  },

  async getRateById(req: Request, res: Response) {
    const rate = await planService.getRateById(Number(req.params.id));
    if (!rate) return res.status(404).json({ success: false, message: "Rate not found" });
    res.json({ success: true, data: rate });
  },

  async listRatesByPlan(req: Request, res: Response) {
    const rates = await planService.listRatesByPlan(Number(req.params.planId));
    res.json({ success: true, data: rates });
  },

  async updateRate(req: Request, res: Response) {
    const updated = await planService.updateRate(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ success: false, message: "Rate not found" });
    res.json({ success: true, data: updated });
  },

  async deleteRate(req: Request, res: Response) {
    const deleted = await planService.deleteRate(Number(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "Rate not found" });
    res.json({ success: true, data: deleted });
  },
};
