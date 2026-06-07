import { z } from "zod";

export const upsertBusinessProfileSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branch: z.string().optional(),
});

export const createFestivalSchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().url().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  isActive: z.boolean().default(true),
});

export const updateFestivalSchema = createFestivalSchema.partial();

export type UpsertBusinessProfileInput = z.infer<typeof upsertBusinessProfileSchema>;
export type CreateFestivalInput = z.infer<typeof createFestivalSchema>;
export type UpdateFestivalInput = z.infer<typeof updateFestivalSchema>;
