import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { statements, statementItems, invoices, invoiceItems } from "../db/schema";
import { CreateStatementInput, UpdateStatementInput } from "../validators/statement.validator";
import { generateStatementNumber } from "../utils/numberGenerator";

export const statementService = {
  async create(data: CreateStatementInput) {
    return db.transaction(async (tx) => {
      const statementNumber = await generateStatementNumber();

      const [statement] = await tx
        .insert(statements)
        .values({
          statementNumber,
          clientId: data.clientId,
          statementDate: new Date(data.statementDate),
          remarks: data.remarks,
          title: data.title,
        })
        .returning();

      await tx.insert(statementItems).values(
        data.invoiceIds.map((invoiceId) => ({
          statementId: statement.id,
          invoiceId,
        }))
      );

      return statement;
    });
  },

  async getById(id: number) {
    const [statement] = await db
      .select()
      .from(statements)
      .where(eq(statements.id, id));

    if (!statement) return null;

    const items = await db
      .select({ invoiceId: statementItems.invoiceId })
      .from(statementItems)
      .where(eq(statementItems.statementId, id));

    const invoiceIds = items.map((i) => i.invoiceId);

    let invoiceList: any[] = [];
    if (invoiceIds.length > 0) {
      const invoicesRows = await db
        .select()
        .from(invoices)
        .where(inArray(invoices.id, invoiceIds));

      const itemsRows = await db
        .select()
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, invoiceIds))
        .orderBy(invoiceItems.id);

      // Group items by invoiceId
      const itemsByInvoiceId = new Map<number, typeof invoiceItems.$inferSelect[]>();
      for (const item of itemsRows) {
        if (!itemsByInvoiceId.has(item.invoiceId)) {
          itemsByInvoiceId.set(item.invoiceId, []);
        }
        itemsByInvoiceId.get(item.invoiceId)!.push(item);
      }

      invoiceList = invoicesRows.map((inv) => ({
        ...inv,
        items: itemsByInvoiceId.get(inv.id) || [],
      }));
    }

    return { ...statement, invoices: invoiceList };
  },

  async listByClient(clientId: number) {
    return db
      .select()
      .from(statements)
      .where(eq(statements.clientId, clientId));
  },

  async update(id: number, data: UpdateStatementInput) {
    return db.transaction(async (tx) => {
      const { invoiceIds, ...fields } = data;

      const updatePayload: Record<string, any> = {};
      if (fields.statementDate) updatePayload.statementDate = new Date(fields.statementDate);
      if (fields.remarks !== undefined) updatePayload.remarks = fields.remarks;
      if (fields.title !== undefined) updatePayload.title = fields.title;

      const [updated] = await tx
        .update(statements)
        .set(updatePayload)
        .where(eq(statements.id, id))
        .returning();

      if (invoiceIds) {
        await tx.delete(statementItems).where(eq(statementItems.statementId, id));
        await tx.insert(statementItems).values(
          invoiceIds.map((invoiceId) => ({ statementId: id, invoiceId }))
        );
      }

      return updated ?? null;
    });
  },

  async delete(id: number) {
    return db.transaction(async (tx) => {
      await tx.delete(statementItems).where(eq(statementItems.statementId, id));
      const [deleted] = await tx.delete(statements).where(eq(statements.id, id)).returning();
      return deleted ?? null;
    });
  },
};
