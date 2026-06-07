import { z } from "zod";

export const createPlanSchema = z.object({
  clientId: z.number().int().positive(),
  name: z.string().min(1, "Plan name is required"),
});

export const updatePlanSchema = createPlanSchema.partial();

export const createPlanRateSchema = z.object({
  planId: z.number().int().positive(),
  serviceType: z.string().optional(),
  vehicleType: z.string().optional(),
  acType: z.string().optional(),
  rate: z.number().optional(),
  extraRate: z.number().optional(),
});

export const updatePlanRateSchema = createPlanRateSchema.partial();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreatePlanRateInput = z.infer<typeof createPlanRateSchema>;
export type UpdatePlanRateInput = z.infer<typeof updatePlanRateSchema>;
