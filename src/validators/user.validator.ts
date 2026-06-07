import { z } from "zod";

export const updateRoleSchema = z.object({
  role: z.enum(["admin", "staff", "viewer"]),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type SetActiveInput = z.infer<typeof setActiveSchema>;