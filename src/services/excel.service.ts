import ExcelJS from "exceljs";
import { Readable } from "stream";
import { invoiceService } from "./invoice.service";
import { clientService } from "./client.service";
import { statementService } from "./statement.service";
import { InvoiceListQuery } from "../validators/invoice.validator";
import { db } from "../db";
import { invoices, invoiceItems, statements, statementItems, clients } from "../db/schema";
import { eq, or, ilike } from "drizzle-orm";

function formatInvoiceNumberForDisplay(
  invoiceNumber: string | null | undefined,
  previousInvoiceNumber?: string | null
): string {
  if (previousInvoiceNumber) {
    return previousInvoiceNumber;
  }
  if (!invoiceNumber) return "";
  const match = invoiceNumber.match(/^INV-\d{4}-0*(\d+)$/i);
  if (match) {
    return match[1];
  }
  return invoiceNumber;
}

function formatTimeOnly(timeInput: any): string {
  if (!timeInput) return "-";

  let date: Date;

  if (timeInput instanceof Date) {
    date = timeInput;
  } else {
    const trimmed = String(timeInput).trim();
    if (!trimmed) return "-";

    // 1. Check if it's already in "hh:mm AM/PM" or "h:mm AM/PM" format, return normalized
    const ampmRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    if (ampmRegex.test(trimmed)) {
      const match = trimmed.match(ampmRegex)!;
      const hour = match[1].padStart(2, "0");
      const minute = match[2];
      const period = match[3].toUpperCase();
      return `${hour}:${minute} ${period}`;
    }

    // 2. Check if it's 24h time "HH:MM" or "HH:MM:SS"
    const time24hRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
    if (time24hRegex.test(trimmed)) {
      const match = trimmed.match(time24hRegex)!;
      let hour = parseInt(match[1], 10);
      const minute = match[2];
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${String(hour).padStart(2, "0")}:${minute} ${period}`;
    }

    // 3. Try to parse as date/ISO string
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp)) {
      date = new Date(timestamp);
    } else {
      return trimmed;
    }
  }

  try {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = String(hours).padStart(2, "0");
    const minutesStr = String(minutes).padStart(2, "0");
    return `${hoursStr}:${minutesStr} ${ampm}`;
  } catch (e) {
    return String(timeInput);
  }
}

export const excelService = {
  /**
   * Export a list of invoices to Excel with summary rows.
   */
  async exportInvoices(query: InvoiceListQuery): Promise<ExcelJS.Buffer> {
    // Fetch all (override pagination for export)
    const result = await invoiceService.list({ ...query, page: 1, limit: 1000 });
    const rows = result.data;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Safe Tours and Travels";

    const sheet = workbook.addWorksheet("Invoices");

    // ── Column definitions ─────────────────────────────────────────────────────
    sheet.columns = [
      { header: "Invoice No", key: "invoiceNumber", width: 18 },
      { header: "Date", key: "invoiceDate", width: 14 },
      { header: "Client ID", key: "clientId", width: 10 },
      { header: "Username", key: "username", width: 15 },
      { header: "Department", key: "department", width: 15 },
      { header: "Journey Month", key: "journeyMonth", width: 16 },
      { header: "Vehicle", key: "vehicleNumber", width: 14 },
      { header: "Total KM", key: "totalKm", width: 10 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "SGST (2.5%)", key: "sgst", width: 14 },
      { header: "CGST (2.5%)", key: "cgst", width: 14 },
      { header: "Total", key: "total", width: 12 },
      { header: "Round Off", key: "roundoffTotal", width: 12 },
    ];

    // ── Header style ───────────────────────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      // Safe Tours and Travels Theme Color - brandOrange (#EA580C)
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FFEA580C" } },
      };
    });
    headerRow.height = 24;

    // ── Data rows ─────────────────────────────────────────────────────────────
    let grandTotal = 0;

    for (const inv of rows) {
      const row = sheet.addRow({
        invoiceNumber: formatInvoiceNumberForDisplay(inv.invoiceNumber, inv.previousInvoiceNumber).toUpperCase(),
        invoiceDate: new Date(inv.invoiceDate).toLocaleDateString("en-IN"),
        clientId: inv.clientId,
        username: (inv.username ?? "").toUpperCase(),
        department: (inv.department ?? "").toUpperCase(),
        journeyMonth: (inv.journeyMonth ?? "").toUpperCase(),
        vehicleNumber: (inv.vehicleNumber ?? "").toUpperCase(),
        totalKm: inv.totalKm ?? "",
        subtotal: Number(inv.subtotal) || 0,
        sgst: Number(inv.sgst) || 0,
        cgst: Number(inv.cgst) || 0,
        total: Number(inv.total) || 0,
        roundoffTotal: Number(inv.roundoffTotal) || 0,
      });

      grandTotal += Number(inv.roundoffTotal) || 0;

      // Zebra striping using a soft orange/peach tint or neutral blue-grey
      if (row.number % 2 === 0) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF4F0" } };
        });
      }

      row.getCell("subtotal").numFmt = '₹#,##0.00';
      row.getCell("sgst").numFmt = '₹#,##0.00';
      row.getCell("cgst").numFmt = '₹#,##0.00';
      row.getCell("total").numFmt = '₹#,##0.00';
      row.getCell("roundoffTotal").numFmt = '₹#,##0.00';
    }

    // ── Summary row ───────────────────────────────────────────────────────────
    const summaryRow = sheet.addRow({
      invoiceNumber: "GRAND TOTAL",
      roundoffTotal: grandTotal,
    });
    summaryRow.getCell("invoiceNumber").font = { bold: true };
    summaryRow.getCell("roundoffTotal").font = { bold: true };
    summaryRow.getCell("roundoffTotal").numFmt = '₹#,##0.00';

    return workbook.xlsx.writeBuffer();
  },

  /**
   * Export a single invoice with itemised breakdown.
   */
  async exportInvoiceDetail(invoiceId: number): Promise<ExcelJS.Buffer> {
    const invoice = await invoiceService.getById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoice Detail");

    // Title
    sheet.mergeCells("A1:E1");
    sheet.getCell("A1").value = `SAFE TOURS AND TRAVELS - INVOICE: ${invoice.invoiceNumber.toUpperCase()}`;
    sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 30;

    sheet.addRow([]);

    // Invoice Metadata Block
    sheet.addRow(["Client Name:", invoice.clientId, "", "Invoice Date:", new Date(invoice.invoiceDate).toLocaleDateString("en-IN")]);
    sheet.addRow(["Username:", invoice.username || "-", "", "Department:", invoice.department || "-"]);
    sheet.addRow(["Vehicle Type:", invoice.vehicleType || "-", "", "Vehicle Plate:", invoice.vehicleNumber || "-"]);
    sheet.addRow(["Start KM:", invoice.startKm ?? "-", "End KM:", invoice.endKm ?? "-", "Total KM:", invoice.totalKm ?? "-"]);
    
    // Format metadata block
    for (let r = 3; r <= 6; r++) {
      const row = sheet.getRow(r);
      row.getCell(1).font = { bold: true };
      row.getCell(3).font = { bold: true };
      row.getCell(4).font = { bold: true };
    }
    sheet.addRow([]);

    // Item columns matching description, rate, usage, total
    sheet.columns = [
      { header: "Type", key: "type", width: 16 },
      { header: "Description", key: "description", width: 32 },
      { header: "Rate", key: "rate", width: 14 },
      { header: "Usage (Qty)", key: "quantity", width: 14 },
      { header: "Total", key: "amount", width: 16 },
    ];

    const headerRow = sheet.getRow(8);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEA580C" } };
      cell.alignment = { horizontal: "center" };
    });
    headerRow.height = 24;

    const items = (invoice as any).items ?? [];
    for (const item of items) {
      sheet.addRow({
        type: (item.type ?? "").toUpperCase(),
        description: (item.description ?? "").toUpperCase(),
        rate: Number(item.rate) || "",
        quantity: Number(item.quantity) || 1,
        amount: Number(item.amount) || 0,
      });
    }

    // Totals section
    sheet.addRow([]);
    sheet.addRow(["", "", "", "Subtotal", Number(invoice.subtotal)]);
    sheet.addRow(["", "", "", "SGST (2.5%)", Number(invoice.sgst)]);
    sheet.addRow(["", "", "", "CGST (2.5%)", Number(invoice.cgst)]);
    sheet.addRow(["", "", "", "Total", Number(invoice.total)]);

    const roundRow = sheet.addRow(["", "", "", "Round Off Total", Number(invoice.roundoffTotal)]);
    roundRow.getCell(4).font = { bold: true };
    roundRow.getCell(5).font = { bold: true };

    // Format all amount numbers in the list
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 8) {
        row.getCell("rate").numFmt = '₹#,##0.00';
        row.getCell("amount").numFmt = '₹#,##0.00';
        
        // Totals rows matching cells
        if (row.getCell(4).value && typeof row.getCell(4).value === "string") {
          row.getCell(5).numFmt = '₹#,##0.00';
        }
      }
    });

    return workbook.xlsx.writeBuffer();
  },

  /**
   * Import historical invoices from spreadsheet binary buffer.
   */
  async importInvoices(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    const isZip = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
    if (isZip) {
      await workbook.xlsx.load(buffer as any);
    } else {
      await workbook.csv.read(Readable.from(buffer));
    }
    
    if (workbook.worksheets.length === 0) {
      throw new Error("Spreadsheet contains no worksheets");
    }

    let totalRows = 0;
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const parseNum = (val: any): number => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const clean = val.replace(/[^0-9.-]/g, "");
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    const parseDateString = (val: any): string => {
      if (val instanceof Date) return val.toISOString();
      if (typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString();
        const parts = val.split(/[-/]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d2 = new Date(year, month, day);
          if (!isNaN(d2.getTime())) return d2.toISOString();
        }
      }
      if (typeof val === "number") {
        return new Date((val - 25569) * 86400 * 1000).toISOString();
      }
      return new Date().toISOString();
    };

    const parseDate = (val: any): Date => {
      if (val instanceof Date) return val;
      if (typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const parts = val.split(/[-/]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d2 = new Date(year, month, day);
          if (!isNaN(d2.getTime())) return d2;
        }
      }
      if (typeof val === "number") {
        return new Date((val - 25569) * 86400 * 1000);
      }
      return new Date();
    };

    const parseNumber = (val: any, fallback = 0): number => {
      if (typeof val === "number") return val;
      if (typeof val === "string") {
        const clean = val.replace(/[^0-9.-]/g, "");
        const num = parseFloat(clean);
        return isNaN(num) ? fallback : num;
      }
      return fallback;
    };

    for (const worksheet of workbook.worksheets) {
      let hasAnyRow = false;
      worksheet.eachRow(() => {
        hasAnyRow = true;
      });
      if (!hasAnyRow) {
        continue;
      }

      let hasListHeaders = false;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        const val = cell.value ? String(cell.value).trim().toLowerCase() : "";
        if (
          val.includes("invoice no") ||
          val.includes("invoice number") ||
          val.includes("bill no") ||
          val.includes("client name")
        ) {
          hasListHeaders = true;
        }
      });

      if (!hasListHeaders) {
        const cell = (ref: string) => {
          let val = worksheet.getCell(ref).value;
          if (val && typeof val === "object" && val !== null) {
            if ("result" in val) {
              val = (val as any).result;
            } else if ("text" in val) {
              val = (val as any).text;
            }
          }
          return val;
        };

        const invoiceNumberVal = cell("I6");
        if (!invoiceNumberVal) {
          console.log(`Sheet "${worksheet.name}": No invoice number found in cell I6. Skipping.`);
          continue;
        }

        totalRows++;
        const invoiceNumber = String(invoiceNumberVal).trim();

        try {
          const [existing] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.invoiceNumber, invoiceNumber))
            .limit(1);

          if (existing) {
            skippedCount++;
            continue;
          }

          const clientFullVal = cell("A5");
          if (!clientFullVal) {
            errors.push(`Sheet "${worksheet.name}": Missing client name in cell A5`);
            continue;
          }
          const clientFull = String(clientFullVal).trim();
          const bracketIndex = clientFull.search(/[\(\[]/);
          let clientName = clientFull;
          let department: string | null = null;
          if (bracketIndex !== -1) {
            clientName = clientFull.substring(0, bracketIndex).trim();
            const endIndex = clientFull.search(/[\)\]]/);
            department = clientFull.substring(bracketIndex + 1, endIndex !== -1 ? endIndex : undefined).trim();
          }

          let client = await db
            .select()
            .from(clients)
            .where(ilike(clients.name, clientName))
            .limit(1)
            .then((res) => res[0] || null);

          if (!client) {
            [client] = await db
              .insert(clients)
              .values({ name: clientName })
              .returning();
          }

          const invoiceDate = parseDateString(cell("I5"));
          const journeyStartDate = cell("I7") ? parseDateString(cell("I7")) : undefined;
          const journeyEndDate = cell("I8") ? parseDateString(cell("I8")) : undefined;

          let username: string | null = null;
          let journeyMonth: string | null = null;
          const c7Raw = cell("C7");
          const e7Raw = cell("E7");
          const c7Val = c7Raw ? String(c7Raw).trim() : "";
          const e7Val = e7Raw ? String(e7Raw).trim() : "";

          if (c7Val && e7Val) {
            username = c7Val;
            journeyMonth = e7Val;
          } else if (c7Val) {
            const parts = c7Val.split(/[\/\-\|]/);
            if (parts.length > 1) {
              username = parts[0].trim();
              journeyMonth = parts[1].trim();
            } else {
              const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
              if (months.includes(c7Val.toLowerCase())) {
                journeyMonth = c7Val;
              } else {
                username = c7Val;
              }
            }
          }

          const vehicleType = cell("A10") ? String(cell("A10")).trim() : null;
          const vehicleModel = cell("C10") ? String(cell("C10")).trim() : null;
          const vehicleNumber = cell("E10") ? String(cell("E10")).trim() : null;
          const isAcVal = String(cell("G10") || "").toLowerCase();
          const isAc = isAcVal.includes("yes") || isAcVal.includes("ac") || isAcVal.includes("true");
          const destination = cell("I10") ? String(cell("I10")).trim() : null;

          const startKm = cell("A14") ? Math.round(parseNum(cell("A14"))) : null;
          const endKm = cell("C14") ? Math.round(parseNum(cell("C14"))) : null;
          const totalKm = cell("E14") ? Math.round(parseNum(cell("E14"))) : null;
          const startTime = cell("G14") ? formatTimeOnly(cell("G14")) : null;
          const endTime = cell("I14") ? formatTimeOnly(cell("I14")) : null;

          const parkingCharges = cell("I21") ? parseNum(cell("I21")) : 0;
          const tollCharges = cell("I22") ? parseNum(cell("I22")) : 0;

          const items: any[] = [];

          const baseDesc = cell("A17") ? String(cell("A17")).trim() : "Travel Services";
          const baseRate = parseNum(cell("E12"));
          if (baseRate > 0) {
            items.push({
              type: "base",
              description: baseDesc,
              rate: baseRate,
              quantity: 1,
              amount: baseRate,
            });
          }

          const extraDesc = cell("A20") ? String(cell("A20")).trim() : "Extra KM Charges";
          const extraRate = parseNum(cell("E20"));
          const extraUsage = parseNum(cell("G20"));
          if (extraUsage > 0) {
            items.push({
              type: "extra_km",
              description: extraDesc,
              rate: extraRate,
              quantity: extraUsage,
              amount: extraRate * extraUsage,
            });
          }

          const waitingRate = parseNum(cell("G12"));
          if (waitingRate > 0) {
            items.push({
              type: "waiting",
              description: "Waiting Charges",
              rate: waitingRate,
              quantity: 1,
              amount: waitingRate,
            });
          }

          const nightRate = parseNum(cell("G13"));
          if (nightRate > 0) {
            items.push({
              type: "night",
              description: "Night Halt",
              rate: nightRate,
              quantity: 1,
              amount: nightRate,
            });
          }

          const dynamicLabel = cell("E23") ? String(cell("E23")).trim() : "";
          const dynamicVal = parseNum(cell("I23"));
          if (dynamicVal > 0) {
            let type = "waiting";
            if (dynamicLabel.toLowerCase().includes("night")) {
              type = "night";
            }
            items.push({
              type,
              description: dynamicLabel || "Waiting / Night Charges",
              rate: dynamicVal,
              quantity: 1,
              amount: dynamicVal,
            });
          }

          const notes = destination ? `Destination: ${destination}` : undefined;

          const invoicePayload = {
            invoiceNumber,
            clientId: client.id,
            invoiceDate,
            journeyStartDate: journeyStartDate ?? undefined,
            journeyEndDate: journeyEndDate ?? undefined,
            vehicleType: vehicleType ?? undefined,
            vehicleModel: vehicleModel ?? undefined,
            vehicleNumber: vehicleNumber ?? undefined,
            isAc,
            startKm: startKm ?? undefined,
            endKm: endKm ?? undefined,
            totalKm: totalKm ?? undefined,
            startTime: startTime ?? undefined,
            endTime: endTime ?? undefined,
            parkingCharges,
            tollCharges,
            notes,
            username: username ?? undefined,
            department: department ?? undefined,
            items,
          };

          await invoiceService.create(invoicePayload);
          importedCount++;
        } catch (err: any) {
          errors.push(`Sheet "${worksheet.name}": ${err.message || "Unknown error"}`);
        }
      } else {
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value ? String(cell.value).trim().toLowerCase() : "";
        });

        const getVal = (row: ExcelJS.Row, fieldNames: string[], defaultValue: any = null) => {
          for (const name of fieldNames) {
            const idx = headers.findIndex(h => h && h.includes(name.toLowerCase()));
            if (idx !== -1) {
              const cell = row.getCell(idx);
              if (cell && cell.value !== undefined && cell.value !== null) {
                let val = cell.value;
                if (typeof val === "object" && val !== null) {
                  if ("result" in val) {
                    val = (val as any).result;
                  } else if ("text" in val) {
                    val = (val as any).text;
                  }
                }
                return val;
              }
            }
          }
          return defaultValue;
        };

        await db.transaction(async (tx) => {
          for (let r = 2; r <= worksheet.rowCount; r++) {
            const row = worksheet.getRow(r);
            let hasData = false;
            row.eachCell(() => {
              hasData = true;
            });
            if (!hasData) continue;

            totalRows++;

            try {
              const invoiceNoVal = getVal(row, ["invoice no", "invoice number", "bill no", "bill number", "inv no"]);
              if (!invoiceNoVal) {
                errors.push(`Sheet "${worksheet.name}" Row ${r}: Missing invoice number`);
                continue;
              }

              const invoiceNumberStr = String(invoiceNoVal).trim();

              const [existing] = await tx
                .select()
                .from(invoices)
                .where(eq(invoices.invoiceNumber, invoiceNumberStr))
                .limit(1);

              if (existing) {
                skippedCount++;
                continue;
              }

              const clientNameVal = getVal(row, ["client name", "client", "customer"]);
              if (!clientNameVal) {
                errors.push(`Sheet "${worksheet.name}" Row ${r}: Missing client name`);
                continue;
              }

              const clientName = String(clientNameVal).trim();

              let client = await tx
                .select()
                .from(clients)
                .where(ilike(clients.name, clientName))
                .limit(1)
                .then((res) => res[0] || null);

              if (!client) {
                [client] = await tx
                  .insert(clients)
                  .values({ name: clientName })
                  .returning();
              }

              const dateVal = getVal(row, ["invoice date", "bill date", "date"]);
              const invoiceDate = parseDate(dateVal);

              const username = getVal(row, ["username", "user"]) ? String(getVal(row, ["username", "user"])).trim() : null;
              const department = getVal(row, ["department", "dept"]) ? String(getVal(row, ["department", "dept"])).trim() : null;
              const journeyMonth = getVal(row, ["journey month", "month"]) ? String(getVal(row, ["journey month", "month"])).trim() : null;
              const vehicleNumber = getVal(row, ["vehicle number", "vehicle no", "vehicle"]) ? String(getVal(row, ["vehicle number", "vehicle no", "vehicle"])).trim() : null;
              const totalKm = getVal(row, ["total km", "km", "kilometers"]) ? Math.round(parseNumber(getVal(row, ["total km", "km", "kilometers"]))) : null;

              const totalVal = parseNumber(getVal(row, ["total", "gross total"]));
              const roundoffVal = getVal(row, ["round off", "roundoff"]) ? parseNumber(getVal(row, ["round off", "roundoff"])) : Math.round(totalVal);
              const subtotalVal = getVal(row, ["subtotal"]) ? parseNumber(getVal(row, ["subtotal"])) : totalVal / 1.05;

              const sgstVal = getVal(row, ["sgst"]) ? parseNumber(getVal(row, ["sgst"])) : subtotalVal * 0.025;
              const cgstVal = getVal(row, ["cgst"]) ? parseNumber(getVal(row, ["cgst"])) : sgstVal;

              const notes = getVal(row, ["notes", "remarks", 'remark']) ? String(getVal(row, ["notes", "remarks", 'remark'])).trim() : null;

              const [invoice] = await tx
                .insert(invoices)
                .values({
                  invoiceNumber: invoiceNumberStr,
                  previousInvoiceNumber: invoiceNumberStr,
                  clientId: client.id,
                  invoiceDate,
                  journeyMonth,
                  vehicleNumber,
                  totalKm,
                  subtotal: subtotalVal.toFixed(2),
                  sgst: sgstVal.toFixed(2),
                  cgst: cgstVal.toFixed(2),
                  total: totalVal.toFixed(2),
                  roundoffTotal: Math.round(roundoffVal).toString(),
                  notes,
                  username,
                  department,
                })
                .returning();

              await tx
                .insert(invoiceItems)
                .values({
                  invoiceId: invoice.id,
                  type: "base",
                  description: "Travel Services",
                  rate: subtotalVal.toFixed(2),
                  quantity: "1",
                  amount: subtotalVal.toFixed(2),
                });

              importedCount++;
            } catch (err: any) {
              errors.push(`Sheet "${worksheet.name}" Row ${r}: ${err.message || "Unknown error"}`);
            }
          }
        });
      }
    }

    return { totalRows, importedCount, skippedCount, errors };
  },

  /**
   * Import historical statements from spreadsheet binary buffer.
   */
  async importStatements(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    const isZip = buffer.length > 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
    if (isZip) {
      await workbook.xlsx.load(buffer as any);
    } else {
      await workbook.csv.read(Readable.from(buffer));
    }
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Spreadsheet contains no worksheets");
    }

    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value ? String(cell.value).trim().toLowerCase() : "";
    });

    const getVal = (row: ExcelJS.Row, fieldNames: string[], defaultValue: any = null) => {
      for (const name of fieldNames) {
        const idx = headers.findIndex(h => h && h.includes(name.toLowerCase()));
        if (idx !== -1) {
          const cell = row.getCell(idx);
          if (cell && cell.value !== undefined && cell.value !== null) {
            let val = cell.value;
            if (typeof val === "object" && val !== null) {
              if ("result" in val) {
                val = (val as any).result;
              } else if ("text" in val) {
                val = (val as any).text;
              }
            }
            return val;
          }
        }
      }
      return defaultValue;
    };

    const parseDate = (val: any): Date => {
      if (val instanceof Date) return val;
      if (typeof val === "string") {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const parts = val.split(/[-/]/);
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          const d2 = new Date(year, month, day);
          if (!isNaN(d2.getTime())) return d2;
        }
      }
      if (typeof val === "number") {
        return new Date((val - 25569) * 86400 * 1000);
      }
      return new Date();
    };

    let totalRows = 0;
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    await db.transaction(async (tx) => {
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        let hasData = false;
        row.eachCell(() => {
          hasData = true;
        });
        if (!hasData) continue;

        totalRows++;

        try {
          const statementNoVal = getVal(row, ["statement no", "statement number", "stmt no", "stmt number"]);
          if (!statementNoVal) {
            errors.push(`Row ${r}: Missing statement number`);
            continue;
          }

          const statementNumberStr = String(statementNoVal).trim();

          // Check if statement number already exists in DB
          const [existing] = await tx
            .select()
            .from(statements)
            .where(eq(statements.statementNumber, statementNumberStr))
            .limit(1);

          if (existing) {
            skippedCount++;
            continue;
          }

          const clientNameVal = getVal(row, ["client name", "client", "customer"]);
          if (!clientNameVal) {
            errors.push(`Row ${r}: Missing client name`);
            continue;
          }

          const clientName = String(clientNameVal).trim();

          // Get or create client
          let client = await tx
            .select()
            .from(clients)
            .where(ilike(clients.name, clientName))
            .limit(1)
            .then((res) => res[0] || null);

          if (!client) {
            [client] = await tx
              .insert(clients)
              .values({ name: clientName })
              .returning();
          }

          const dateVal = getVal(row, ["statement date", "date"]);
          const statementDate = parseDate(dateVal);

          const remarks = getVal(row, ["remarks", "remark", "notes"]) ? String(getVal(row, ["remarks", "remark", "notes"])).trim() : null;
          const title = getVal(row, ["title", "statement title"]) ? String(getVal(row, ["title", "statement title"])).trim() : null;

          const invoicesVal = getVal(row, ["invoices", "invoice list", "bills"]);
          const invNumbers = invoicesVal
            ? String(invoicesVal)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

          const linkedInvoiceIds: number[] = [];

          for (const invNum of invNumbers) {
            // Find invoice by standard invoiceNumber OR by the new previousInvoiceNumber
            const [dbInv] = await tx
              .select({ id: invoices.id })
              .from(invoices)
              .where(
                or(
                  eq(invoices.invoiceNumber, invNum),
                  eq(invoices.previousInvoiceNumber, invNum)
                )
              )
              .limit(1);

            if (dbInv) {
              linkedInvoiceIds.push(dbInv.id);
            } else {
              errors.push(`Row ${r}: Invoice "${invNum}" not found in database. Skipping association.`);
            }
          }

          // Insert statement
          const [statement] = await tx
            .insert(statements)
            .values({
              statementNumber: statementNumberStr,
              clientId: client.id,
              statementDate,
              remarks,
              title,
            })
            .returning();

          // Insert statementItems
          if (linkedInvoiceIds.length > 0) {
            await tx
              .insert(statementItems)
              .values(
                linkedInvoiceIds.map((invoiceId) => ({
                  statementId: statement.id,
                  invoiceId,
                }))
              );
          }

          importedCount++;
        } catch (err: any) {
          errors.push(`Row ${r}: ${err.message || "Unknown error"}`);
        }
      }
    });

    return { totalRows, importedCount, skippedCount, errors };
  },
};
