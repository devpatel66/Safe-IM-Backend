import { z } from "zod";

export const createStatementSchema = z.object({
  clientId: z.number().int().positive(),
  statementDate: z.string().datetime(),
  invoiceIds: z.array(z.number().int().positive()).min(1, "At least one invoice required"),
  remarks: z.string().optional(),
  title: z.string().optional(),
});

export const updateStatementSchema = z.object({
  statementDate: z.string().datetime().optional(),
  invoiceIds: z.array(z.number().int().positive()).optional(),
  remarks: z.string().optional(),
  title: z.string().optional(),
});

export type CreateStatementInput = z.infer<typeof createStatementSchema>;
export type UpdateStatementInput = z.infer<typeof updateStatementSchema>;
