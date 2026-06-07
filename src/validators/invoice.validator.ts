import { z } from "zod";

const invoiceItemSchema = z.object({
  type: z.string().optional(),
  description: z.string().optional(),
  rate: z.number().optional(),
  quantity: z.number().optional(),
  amount: z.number(),
});

export const createInvoiceSchema = z.object({
  // Required
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  clientId: z.number().int().positive(),
  invoiceDate: z.string().datetime(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),

  // Optional invoice-level fields
  planId: z.number().int().positive().optional(),
  journeyMonth: z.string().optional(),
  journeyStartDate: z.string().datetime().optional(),
  journeyEndDate: z.string().datetime().optional(),

  vehicleType: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleNumber: z.string().optional(),
  isAc: z.boolean().optional(),

  startKm: z.number().int().optional(),
  endKm: z.number().int().optional(),
  totalKm: z.number().int().optional(),

  startTime: z.string().optional(),
  endTime: z.string().optional(),

  parkingCharges: z.number().default(0),
  tollCharges: z.number().default(0),

  notes: z.string().optional(),
  username: z.string().optional(),
  department: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required").optional(),
  invoiceDate: z.string().datetime().optional(),
  journeyMonth: z.string().optional(),
  journeyStartDate: z.string().datetime().optional(),
  journeyEndDate: z.string().datetime().optional(),
  planId: z.number().int().positive().optional(),
  vehicleType: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleNumber: z.string().optional(),
  isAc: z.boolean().optional(),
  startKm: z.number().int().optional(),
  endKm: z.number().int().optional(),
  totalKm: z.number().int().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  parkingCharges: z.number().optional(),
  tollCharges: z.number().optional(),
  notes: z.string().optional(),
  username: z.string().optional(),
  department: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
});

export const invoiceListQuerySchema = z.object({
  clientId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  journeyMonth: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
