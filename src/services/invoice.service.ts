import { eq, and, gte, lte, ilike, or, count, desc } from "drizzle-orm";
import { db } from "../db";
import { invoices, invoiceItems, statementItems } from "../db/schema";
import { CreateInvoiceInput, UpdateInvoiceInput, InvoiceListQuery } from "../validators/invoice.validator";
import { numberToWords } from "../utils/numberToWords";
import { paginate, buildPaginationMeta } from "../utils/pagination";
import { escapeLike } from "../utils/escapeLike";

const GST_RATE = 0.025; // 2.5% SGST + 2.5% CGST

export const invoiceService = {
  async create(data: CreateInvoiceInput) {
    return db.transaction(async (tx) => {
      const { items, parkingCharges = 0, tollCharges = 0, ...fields } = data;

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const sgst = parseFloat((subtotal * GST_RATE).toFixed(2));
      const cgst = sgst;
      const total = parseFloat((subtotal + sgst + cgst + Number(parkingCharges) + Number(tollCharges)).toFixed(2));
      const roundoffTotal = Math.round(total);

      // Insert invoice
      const [invoice] = await tx
        .insert(invoices)
        .values({
          ...fields,
          invoiceDate: new Date(fields.invoiceDate),
          journeyStartDate: fields.journeyStartDate ? new Date(fields.journeyStartDate) : undefined,
          journeyEndDate: fields.journeyEndDate ? new Date(fields.journeyEndDate) : undefined,
          parkingCharges: String(parkingCharges),
          tollCharges: String(tollCharges),
          subtotal: String(subtotal),
          sgst: String(sgst),
          cgst: String(cgst),
          total: String(total),
          roundoffTotal: String(roundoffTotal),
          totalInWords: numberToWords(roundoffTotal),
        })
        .returning();

      // Insert items
      const insertedItems = await tx
        .insert(invoiceItems)
        .values(
          items.map((item) => ({
            invoiceId: invoice.id,
            type: item.type,
            description: item.description,
            rate: item.rate !== undefined ? String(item.rate) : undefined,
            quantity: item.quantity !== undefined ? String(item.quantity) : undefined,
            amount: String(item.amount),
          }))
        )
        .returning();

      return { ...invoice, items: insertedItems };
    });
  },

  async getById(id: number) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return null;

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id));

    return { ...invoice, items };
  },

  async getByInvoiceNumber(invoiceNumber: string) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber));
    return invoice ?? null;
  },

  async list(query: InvoiceListQuery) {
    const { page, limit, clientId, fromDate, toDate, journeyMonth, search } = query;
    const { offset } = paginate(page, limit);

    const conditions = [];

    if (clientId) conditions.push(eq(invoices.clientId, clientId));
    if (journeyMonth) conditions.push(eq(invoices.journeyMonth, journeyMonth));
    if (fromDate) conditions.push(gte(invoices.invoiceDate, new Date(fromDate)));
    if (toDate) conditions.push(lte(invoices.invoiceDate, new Date(toDate)));
    if (search) {
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, `%${escapeLike(search)}%`),
          ilike(invoices.vehicleNumber, `%${escapeLike(search)}%`)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.invoiceNumber))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(invoices).where(where),
    ]);

    return {
      data: rows,
      pagination: buildPaginationMeta(Number(total), page, limit),
    };
  },

  async update(id: number, data: UpdateInvoiceInput) {
    return db.transaction(async (tx) => {
      const { items, ...invoiceFields } = data;

      // Recalculate totals if items provided
      let totalsUpdate: Partial<typeof invoiceFields & {
        subtotal: string;
        sgst: string;
        cgst: string;
        total: string;
        roundoffTotal: string;
        totalInWords: string;
      }> = {};

      if (items) {
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

        // Fetch existing invoice to fallback parking/toll charges if not passed
        const [existing] = await tx.select().from(invoices).where(eq(invoices.id, id));
        const parking = invoiceFields.parkingCharges ?? (existing ? Number(existing.parkingCharges) : 0);
        const toll = invoiceFields.tollCharges ?? (existing ? Number(existing.tollCharges) : 0);
        const sgst = parseFloat((subtotal * GST_RATE).toFixed(2));
        const cgst = sgst;
        const total = parseFloat((subtotal + sgst + cgst + Number(parking) + Number(toll)).toFixed(2));
        const roundoffTotal = Math.round(total);

        totalsUpdate = {
          subtotal: String(subtotal),
          sgst: String(sgst),
          cgst: String(cgst),
          total: String(total),
          roundoffTotal: String(roundoffTotal),
          totalInWords: numberToWords(roundoffTotal),
        };

        // Replace all items
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        await tx.insert(invoiceItems).values(
          items.map((item) => ({
            invoiceId: id,
            type: item.type,
            description: item.description,
            rate: item.rate !== undefined ? String(item.rate) : undefined,
            quantity: item.quantity !== undefined ? String(item.quantity) : undefined,
            amount: String(item.amount),
          }))
        );
      }

      const updatePayload: Record<string, any> = {};

      // Copy scalar fields
      const scalarFields = [
        "invoiceNumber", "invoiceDate", "journeyMonth", "journeyStartDate", "journeyEndDate",
        "planId", "vehicleType", "vehicleModel", "vehicleNumber", "isAc",
        "startKm", "endKm", "totalKm", "startTime", "endTime", "notes",
        "username", "department",
      ] as const;

      for (const field of scalarFields) {
        if (invoiceFields[field] !== undefined) {
          updatePayload[field] =
            field === "invoiceDate" || field === "journeyStartDate" || field === "journeyEndDate"
              ? new Date(invoiceFields[field] as string)
              : invoiceFields[field];
        }
      }

      if (invoiceFields.parkingCharges !== undefined)
        updatePayload.parkingCharges = String(invoiceFields.parkingCharges);
      if (invoiceFields.tollCharges !== undefined)
        updatePayload.tollCharges = String(invoiceFields.tollCharges);

      Object.assign(updatePayload, totalsUpdate);

      const [updated] = await tx
        .update(invoices)
        .set(updatePayload)
        .where(eq(invoices.id, id))
        .returning();

      return updated ?? null;
    });
  },

  async delete(id: number) {
    return db.transaction(async (tx) => {
      await tx.delete(statementItems).where(eq(statementItems.invoiceId, id));
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const [deleted] = await tx.delete(invoices).where(eq(invoices.id, id)).returning();
      return deleted ?? null;
    });
  },
};
