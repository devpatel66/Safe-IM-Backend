import { Request, Response } from "express";
import { userService } from "../services/user.service";

export const userController = {
  async list(req: Request, res: Response) {
    const users = await userService.list();
    res.json({ success: true, data: users });
  },

  async getById(req: Request, res: Response) {
    const user = await userService.getById(Number(req.params.id));
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  },

  async updateRole(req: Request, res: Response) {
    // Prevent admin from changing their own role (lock themselves out)
    if (Number(req.params.id) === req.user!.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role",
      });
    }
    const updated = await userService.updateRole(Number(req.params.id), req.body.role);
    if (!updated) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: updated });
  },

  async setActive(req: Request, res: Response) {
    // Prevent admin from deactivating themselves
    if (Number(req.params.id) === req.user!.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }
    const updated = await userService.setActive(Number(req.params.id), req.body.isActive);
    if (!updated) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: updated });
  },
};