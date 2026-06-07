import { Request, Response } from "express";
import { authService } from "../services/auth.service";

export const authController = {
  async register(req: Request, res: Response) {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  },

  async me(req: Request, res: Response) {
    // req.user comes from the auth middleware (Step 3)
    // For now just return it directly — in Step 3 we'll protect this route
    res.json({ success: true, data: req.user });
  },
};