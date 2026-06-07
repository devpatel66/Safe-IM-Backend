import { db } from "../db";
import { invoices, statements } from "../db/schema";
import { like, desc } from "drizzle-orm";

/**
 * Generates the next invoice number in format: INV-YYYY-XXXXX
 * e.g. INV-2025-00001, INV-2025-00002
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const latest = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(like(invoices.invoiceNumber, `${prefix}%`))
    .orderBy(desc(invoices.invoiceNumber))
    .limit(1);

  let nextSeq = 1;
  if (latest.length > 0) {
    const parts = latest[0].invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}

/**
 * Generates the next statement number in format: STMT-YYYY-XXXXX
 */
export async function generateStatementNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STMT-${year}-`;

  const latest = await db
    .select({ statementNumber: statements.statementNumber })
    .from(statements)
    .where(like(statements.statementNumber, `${prefix}%`))
    .orderBy(desc(statements.statementNumber))
    .limit(1);

  let nextSeq = 1;
  if (latest.length > 0) {
    const parts = latest[0].statementNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}
