import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs";
import path from "path";
import { invoiceService } from "./invoice.service";
import { businessProfileService } from "./businessProfile.service";
import { clientService } from "./client.service";
import { statementService } from "./statement.service";

// ── Helpers ────────────────────────────────────────────────────────────────────

function sanitizePdfText(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/₹/g, "Rs.")
    .replace(/[\r\n\t]+/g, " ");
}

function drawCellText(
  page: PDFPage,
  text: string,
  xStart: number,
  xEnd: number,
  yCenter: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.1, 0.1)
) {
  const cellWidth = xEnd - xStart;
  const sanitizedText = sanitizePdfText(text);
  const textWidth = font.widthOfTextAtSize(sanitizedText, size);
  
  if (textWidth <= cellWidth - 6) {
    // Single line fits, draw centered
    const x = xStart + (cellWidth - textWidth) / 2;
    page.drawText(sanitizedText, { x, y: yCenter - size / 2 + 1, font, size, color });
  } else {
    // Split into two lines
    const words = sanitizedText.split(/\s+/);
    let line1 = "";
    let line2 = "";
    let i = 0;
    
    while (i < words.length) {
      const testLine = line1 ? line1 + " " + words[i] : words[i];
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth <= cellWidth - 6) {
        line1 = testLine;
        i++;
      } else {
        break;
      }
    }
    
    while (i < words.length) {
      line2 = line2 ? line2 + " " + words[i] : words[i];
      i++;
    }
    
    // Draw line 1
    const line1Width = font.widthOfTextAtSize(line1, size);
    const x1 = xStart + (cellWidth - line1Width) / 2;
    page.drawText(line1, { x: x1, y: yCenter + 2, font, size, color });
    
    // Truncate line 2 if it still overflows
    let truncatedLine2 = line2;
    if (font.widthOfTextAtSize(line2, size) > cellWidth - 6) {
      let limitIndex = line2.length;
      while (limitIndex > 0 && font.widthOfTextAtSize(line2.slice(0, limitIndex) + "...", size) > cellWidth - 6) {
        limitIndex--;
      }
      truncatedLine2 = line2.slice(0, limitIndex) + "...";
    }
    
    const line2Width = font.widthOfTextAtSize(truncatedLine2, size);
    const x2 = xStart + (cellWidth - line2Width) / 2;
    page.drawText(truncatedLine2, { x: x2, y: yCenter - size - 1, font, size, color });
  }
}


function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) {
  const sanitizedText = sanitizePdfText(text);
  page.drawText(sanitizedText, { x, y, size, font, color });
}

function drawTextCentered(
  page: PDFPage,
  text: string,
  xStart: number,
  xEnd: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) {
  const sanitizedText = sanitizePdfText(text);
  const textWidth = font.widthOfTextAtSize(sanitizedText, size);
  const x = xStart + (xEnd - xStart - textWidth) / 2;
  page.drawText(sanitizedText, { x, y, size, font, color });
}

function drawTextRight(
  page: PDFPage,
  text: string,
  xEnd: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) {
  const sanitizedText = sanitizePdfText(text);
  const textWidth = font.widthOfTextAtSize(sanitizedText, size);
  const x = xEnd - textWidth;
  page.drawText(sanitizedText, { x, y, size, font, color });
}

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

function formatTimeOnly(timeInput: string | Date | null | undefined): string {
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

function wrapTextRobust(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const sanitized = sanitizePdfText(text);
  const tokens: string[] = [];
  let currentToken = "";
  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    currentToken += char;
    if (char === " " || char === "," || char === "/" || char === "|") {
      tokens.push(currentToken);
      currentToken = "";
    }
  }
  if (currentToken) {
    tokens.push(currentToken);
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const token of tokens) {
    const tokenWidth = font.widthOfTextAtSize(token.trim(), size);
    if (tokenWidth > maxWidth) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      let word = token;
      while (word.length > 0) {
        let splitIdx = 1;
        while (splitIdx <= word.length && font.widthOfTextAtSize(word.slice(0, splitIdx), size) <= maxWidth) {
          splitIdx++;
        }
        splitIdx--;
        if (splitIdx === 0) splitIdx = 1;
        lines.push(word.slice(0, splitIdx));
        word = word.slice(splitIdx);
      }
    } else {
      const testLine = currentLine + token;
      const testWidth = font.widthOfTextAtSize(testLine.trim(), size);
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = token;
      }
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  return lines;
}

function drawLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.4,
  color = rgb(0.3, 0.3, 0.3)
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color,
  });
}

function drawQRAnchor(page: PDFPage, x: number, y: number) {
  // Outer square
  page.drawRectangle({
    x,
    y,
    width: 14,
    height: 14,
    color: rgb(0.1, 0.1, 0.1),
  });
  // Inner white square
  page.drawRectangle({
    x: x + 2,
    y: y + 2,
    width: 10,
    height: 10,
    color: rgb(1, 1, 1),
  });
  // Center square
  page.drawRectangle({
    x: x + 4,
    y: y + 4,
    width: 6,
    height: 6,
    color: rgb(0.1, 0.1, 0.1),
  });
}

// ── Main Service ───────────────────────────────────────────────────────────────

export const pdfService = {
  async generateInvoicePdf(invoiceId: number): Promise<Uint8Array> {
    const invoice = await invoiceService.getById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const business = await businessProfileService.get();
    const client = await clientService.getById(invoice.clientId);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 Size (595.276 x 841.89)
    const { height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Styling constants
    const marginLeft = 40;
    const marginRight = 555;
    const contentWidth = 515;

    const brandOrange = rgb(0.917, 0.345, 0.047);
    const textDark = rgb(0.15, 0.15, 0.15);
    const textLight = rgb(1, 1, 1);
    const borderGrey = rgb(0.5, 0.5, 0.5);
    const lineGrey = rgb(0.85, 0.85, 0.85);

    // ── 0. Watermark ─────────────────────────────────────────────────────────────
    page.drawText("S", {
      x: 180,
      y: 280,
      size: 380,
      font: fontBold,
      color: brandOrange,
      opacity: 0.025,
    });

    // ── 1. Top Orange Header Accent Bar ──────────────────────────────────────────
    let currentY = height - 40; // 802
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 4,
      width: contentWidth,
      height: 4,
      color: brandOrange,
    });
    currentY -= 4; // 798

    // ── 2. Logo & Company Details ──────────────────────────────────────────────
    currentY -= 45; // 753
    
    // Draw Logo Symbol (Image or fallback)
    let hasRealLogo = false;
    let logoWidth = 32;
    const extensions = [".png", ".jpg", ".jpeg"];
    const assetsDir = path.join(__dirname, "../../assets");
    
    for (const ext of extensions) {
      const logoImagePath = path.join(assetsDir, `logo${ext}`);
      if (fs.existsSync(logoImagePath)) {
        try {
          const logoImageBytes = fs.readFileSync(logoImagePath);
          let logoImage;
          if (ext === ".png") {
            logoImage = await pdfDoc.embedPng(logoImageBytes);
          } else {
            logoImage = await pdfDoc.embedJpg(logoImageBytes);
          }
          logoWidth = (logoImage.width / logoImage.height) * 32;
          page.drawImage(logoImage, {
            x: marginLeft,
            y: currentY + 5,
            width: logoWidth,
            height: 32,
          });
          hasRealLogo = true;
          break;
        } catch (err) {
          console.error(`Failed to embed logo${ext}:`, err);
        }
      }
    }

    if (!hasRealLogo) {
      page.drawRectangle({
        x: marginLeft,
        y: currentY + 5,
        width: 32,
        height: 32,
        color: brandOrange,
      });
      drawText(page, "S", marginLeft + 10, currentY + 12, fontBold, 18, textLight);
      logoWidth = 32;
    }

    // Draw Company Name
    const companyNameX = marginLeft + logoWidth + 10;
    drawText(page, "SAFE", companyNameX, currentY + 20, fontBold, 14, brandOrange);
    drawText(page, "TOURS AND TRAVELS", companyNameX, currentY + 8, fontBold, 10.5, brandOrange);

    // Draw Right-aligned Company Details
    const addressLines = [
      sanitizePdfText(business?.address || "1-SARDAR PATEL SOCIETY AMUL DAIRY ROAD"),
      "ANAND, GUJARAT - 388001",
      `EMAIL: ${sanitizePdfText(business?.email || "safetravelsk4u@gmail.com")}`,
      `PHONE: ${sanitizePdfText(business?.phone || "+91 89805 01675, +91 97260 11559")}`,
    ];

    let addrY = currentY + 25;
    for (const line of addressLines) {
      const lineWidth = fontRegular.widthOfTextAtSize(sanitizePdfText(line), 7.5);
      drawText(page, line, marginRight - lineWidth - 5, addrY, fontRegular, 7.5, textDark);
      addrY -= 10;
    }

    currentY -= 25; // 728
    // Horizontal divider
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, lineGrey);

    currentY -= 22; // 706
    drawText(page, "INVOICE", marginLeft, currentY + 4, fontBold, 16, brandOrange);

    const gstText = `GSTIN: ${business?.gstNumber ?? "24AVZPP0095N1Z0"}`;
    const gstTextWidth = fontBold.widthOfTextAtSize(gstText, 9);
    drawText(page, gstText, marginRight - gstTextWidth, currentY + 5, fontBold, 9, textDark);

    currentY -= 5; // 701
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, lineGrey);

    // ── 3. Metadata Columns (Borderless Grid) ───────────────────────────────────
    currentY -= 20; // 681
    const metadataStartY = currentY;

    // Split into 3 columns:
    const col1X = marginLeft; // 40
    const col2X = marginLeft + 195; // 235
    const col3X = marginLeft + 355; // 395

    // Column 1: Client Info
    let colY1 = metadataStartY;
    drawText(page, "BILL TO", col1X, colY1, fontBold, 8.5, brandOrange);
    
    // Client Name
    colY1 -= 13;
    const clientName = (client?.name ?? "").toUpperCase();
    drawText(page, clientName, col1X, colY1, fontBold, 9, textDark);
    
    // Client GSTIN
    colY1 -= 11;
    const clientGst = client?.gstNumber ? `GSTIN: ${client.gstNumber.toUpperCase()}` : "GSTIN: N/A";
    drawText(page, clientGst, col1X, colY1, fontRegular, 8, textDark);

    // Client Username & Department (Separate rows with wrapping support)
    colY1 -= 11;
    const usernameClean = (invoice.username ?? "").trim().toUpperCase() || "-";
    drawText(page, `USER :`, col1X, colY1, fontBold, 8, brandOrange);
    const userLines = wrapTextRobust(usernameClean, fontRegular, 8.5, col2X - col1X - 55);
    drawText(page, userLines[0] || "-", col1X + 45, colY1, fontRegular, 8.5, textDark);
    for (let i = 1; i < userLines.length; i++) {
      colY1 -= 10;
      drawText(page, userLines[i], col1X + 45, colY1, fontRegular, 8.5, textDark);
    }

    colY1 -= 11;
    const deptClean = (invoice.department ?? "").trim().toUpperCase() || "-";
    drawText(page, `DEPT :`, col1X, colY1, fontBold, 8, brandOrange);
    const deptLines = wrapTextRobust(deptClean, fontRegular, 8.5, col2X - col1X - 55);
    drawText(page, deptLines[0] || "-", col1X + 45, colY1, fontRegular, 8.5, textDark);
    for (let i = 1; i < deptLines.length; i++) {
      colY1 -= 10;
      drawText(page, deptLines[i], col1X + 45, colY1, fontRegular, 8.5, textDark);
    }

    // Column 2: Invoice Info
    let colY2 = metadataStartY;
    drawText(page, "INVOICE DETAILS", col2X, colY2, fontBold, 8.5, brandOrange);
    
    colY2 -= 13;
    const invoiceNum = formatInvoiceNumberForDisplay(invoice.invoiceNumber, invoice.previousInvoiceNumber);
    drawText(page, `INVOICE NO :`, col2X, colY2, fontBold, 8, brandOrange);
    drawText(page, invoiceNum, col2X + 68, colY2, fontBold, 8.5, textDark);

    colY2 -= 11;
    const invoiceDateStr = new Date(invoice.invoiceDate).toLocaleDateString("en-IN");
    drawText(page, `DATE :`, col2X, colY2, fontBold, 8, brandOrange);
    drawText(page, invoiceDateStr, col2X + 68, colY2, fontRegular, 8.5, textDark);

    // Journey Month
    colY2 -= 11;
    let journeyMonthVal = invoice.journeyMonth;
    if (!journeyMonthVal) {
      const dateToUse = invoice.journeyStartDate || invoice.journeyEndDate || invoice.invoiceDate;
      if (dateToUse) {
        const months = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const d = new Date(dateToUse);
        if (!isNaN(d.getTime())) {
          journeyMonthVal = months[d.getMonth()];
        }
      }
    }
    const finalJourneyMonth = (journeyMonthVal || "-").toUpperCase();
    drawText(page, `MONTH :`, col2X, colY2, fontBold, 8, brandOrange);
    drawText(page, finalJourneyMonth, col2X + 68, colY2, fontRegular, 8.5, textDark);

    // Column 3: Journey Info
    let colY3 = metadataStartY;
    drawText(page, "JOURNEY DETAILS", col3X, colY3, fontBold, 8.5, brandOrange);

    colY3 -= 13;
    const startDateStr = invoice.journeyStartDate ? new Date(invoice.journeyStartDate).toLocaleDateString("en-IN") : "-";
    drawText(page, `START DATE :`, col3X, colY3, fontBold, 8, brandOrange);
    drawText(page, startDateStr, col3X + 75, colY3, fontRegular, 8.5, textDark);

    colY3 -= 11;
    const endDateStr = invoice.journeyEndDate ? new Date(invoice.journeyEndDate).toLocaleDateString("en-IN") : "-";
    drawText(page, `END DATE :`, col3X, colY3, fontBold, 8, brandOrange);
    drawText(page, endDateStr, col3X + 75, colY3, fontRegular, 8.5, textDark);

    colY3 -= 11;
    const sTime = invoice.startTime && invoice.startTime !== "-" ? formatTimeOnly(invoice.startTime) : "-";
    drawText(page, `START TIME :`, col3X, colY3, fontBold, 8, brandOrange);
    drawText(page, sTime, col3X + 75, colY3, fontRegular, 8.5, textDark);

    colY3 -= 11;
    const eTime = invoice.endTime && invoice.endTime !== "-" ? formatTimeOnly(invoice.endTime) : "-";
    drawText(page, `END TIME :`, col3X, colY3, fontBold, 8, brandOrange);
    drawText(page, eTime, col3X + 75, colY3, fontRegular, 8.5, textDark);

    currentY = Math.min(colY1, colY2, colY3) - 14;
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, lineGrey);

    // ── 4. Vehicle & Odometer Summary Row ────────────────────────────────────────
    currentY -= 15; // 611
    
    // Header labels background block
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 14,
      width: contentWidth,
      height: 14,
      color: rgb(0.97, 0.95, 0.93), // soft tint
    });
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, borderGrey);
    drawLine(page, marginLeft, currentY - 14, marginRight, currentY - 14, 0.6, borderGrey);

    const getVehicleTypeLabel = (vt: string | null | undefined) => {
      if (!vt) return "-";
      const mapping: Record<string, string> = {
        sedan: "Sedan",
        suv: "SUV",
        hatchback: "Hatchback",
        luxury: "Premium SUV",
        tempo_traveler: "Tempo Traveler",
        other: "Other",
      };
      return mapping[vt.toLowerCase()] || vt;
    };

    const odoHeaders = ["VEHICLE TYPE", "VEHICLE MODEL", "CAR NO.", "IS A/C?", "OPENING KM", "CLOSING KM", "TOTAL KM"];
    const odoValues = [
      getVehicleTypeLabel(invoice.vehicleType).toUpperCase(),
      (invoice.vehicleModel || "-").toUpperCase(),
      (invoice.vehicleNumber || "-").toUpperCase(),
      invoice.isAc ? "YES" : "NO",
      invoice.startKm !== null ? String(invoice.startKm) : "-",
      invoice.endKm !== null ? String(invoice.endKm) : "-",
      invoice.totalKm !== null ? `${invoice.totalKm} KM` : "-",
    ];

    const colOdoWidth = contentWidth / 7;
    for (let i = 0; i < 7; i++) {
      const xStart = marginLeft + colOdoWidth * i;
      const xEnd = marginLeft + colOdoWidth * (i + 1);
      drawTextCentered(page, odoHeaders[i], xStart, xEnd, currentY - 10, fontBold, 7, brandOrange);
      drawTextCentered(page, odoValues[i], xStart, xEnd, currentY - 24, fontRegular, 7.5, textDark);
      
      // Draw inner vertical dividing lines
      if (i > 0) {
        drawLine(page, xStart, currentY - 28, xStart, currentY, 0.4, lineGrey);
      }
    }
    currentY -= 28; // 583
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, borderGrey);

    // ── 5. Billing Rates Summary Row ─────────────────────────────────────────────
    currentY -= 15; // 568
    
    // Header labels background block
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 14,
      width: contentWidth,
      height: 14,
      color: rgb(0.97, 0.95, 0.93), // soft tint
    });
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, borderGrey);
    drawLine(page, marginLeft, currentY - 14, marginRight, currentY - 14, 0.6, borderGrey);

    // Calculate billing values
    const items = (invoice as any).items ?? [];
    const baseItem = items.find((it: any) => ["base", "per_km", "airport_ahmedabad", "airport_baroda", "full_day", "half_day", "local_trip"].includes(it.type));
    const extraKmItem = items.find((it: any) => it.type === "extra_km");
    const waitingItem = items.find((it: any) => it.type === "waiting");
    const nightItem = items.find((it: any) => it.type === "night");

    const ratePerKm = extraKmItem ? Number(extraKmItem.rate) : 0;
    const fixKm = invoice.totalKm && extraKmItem ? Math.max(0, Number(invoice.totalKm) - Number(extraKmItem.quantity)) : (baseItem?.description?.includes("80") ? 80 : (baseItem?.description?.includes("250") ? 250 : 0));
    const fixCharge = baseItem ? Number(baseItem.amount) : 0;
    const waitingCharge = waitingItem ? Number(waitingItem.rate) : 0;
    const nightHault = nightItem ? Number(nightItem.rate) : 0;

    const rateHeaders = ["BASE FARE", "FIX KM LIMIT", "RATE PER EXTRA KM", "WAITING FARE/HR", "NIGHT HAULT/DAY"];
    const rateValues = [
      fixCharge ? `Rs. ${fixCharge}` : "-",
      fixKm ? `${fixKm} KM` : "-",
      ratePerKm ? `Rs. ${ratePerKm} / KM` : "-",
      waitingCharge ? `Rs. ${waitingCharge} / HR` : "-",
      nightHault ? `Rs. ${nightHault} / DAY` : "-",
    ];

    const colRateWidth = contentWidth / 5;
    for (let i = 0; i < 5; i++) {
      const xStart = marginLeft + colRateWidth * i;
      const xEnd = marginLeft + colRateWidth * (i + 1);
      drawTextCentered(page, rateHeaders[i], xStart, xEnd, currentY - 10, fontBold, 7, brandOrange);
      drawTextCentered(page, rateValues[i], xStart, xEnd, currentY - 24, fontRegular, 7.5, textDark);

      // Draw inner vertical dividing lines
      if (i > 0) {
        drawLine(page, xStart, currentY - 28, xStart, currentY, 0.4, lineGrey);
      }
    }
    currentY -= 28; // 540
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, borderGrey);

    // ── 6. Main Itemized Charges Table ───────────────────────────────────────────
    currentY -= 20; // 520
    const tableHeaderHeight = 16;
    const tableRowHeight = 18;
    const colDescX = marginLeft;
    const colRateX = 290;
    const colUsageX = 370;
    const colTotalX = 450;
    const endX = marginRight;

    // Header Background
    page.drawRectangle({
      x: marginLeft,
      y: currentY - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: rgb(0.97, 0.95, 0.93),
    });
    
    // Draw top and bottom header lines
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.7, borderGrey);
    drawLine(page, marginLeft, currentY - tableHeaderHeight, marginRight, currentY - tableHeaderHeight, 0.7, borderGrey);

    // Draw Column Headers
    drawTextCentered(page, "DESCRIPTION", colDescX, colRateX, currentY - tableHeaderHeight + 4, fontBold, 8, brandOrange);
    drawTextCentered(page, "RATE", colRateX, colUsageX, currentY - tableHeaderHeight + 4, fontBold, 8, brandOrange);
    drawTextCentered(page, "USAGE", colUsageX, colTotalX, currentY - tableHeaderHeight + 4, fontBold, 8, brandOrange);
    drawTextCentered(page, "TOTAL", colTotalX, endX, currentY - tableHeaderHeight + 4, fontBold, 8, brandOrange);

    // Draw items (excluding extra_km)
    const tableItems = items.filter((it: any) => it.type !== "extra_km");
    let itemY = currentY - tableHeaderHeight; // starts at 504

    for (let index = 0; index < Math.max(3, tableItems.length); index++) {
      const item = tableItems[index];
      itemY -= tableRowHeight; // 504 - 18 = 486

      if (item) {
        const descText = (item.description || item.type || "").toUpperCase();
        drawText(page, descText.slice(0, 48), colDescX + 10, itemY + 5, fontRegular, 8, textDark);
        drawTextCentered(page, item.rate ? `Rs. ${item.rate}` : "-", colRateX, colUsageX, itemY + 5, fontRegular, 8, textDark);
        drawTextCentered(page, item.quantity ? String(item.quantity) : "1", colUsageX, colTotalX, itemY + 5, fontRegular, 8, textDark);
        drawTextCentered(page, `Rs. ${item.amount}`, colTotalX, endX, itemY + 5, fontRegular, 8, textDark);
      } else {
        // Draw empty space holding row
        drawText(page, "-", colDescX + 10, itemY + 5, fontRegular, 8, rgb(0.7, 0.7, 0.7));
      }
      
      // Draw horizontal separator line for each row
      drawLine(page, marginLeft, itemY, marginRight, itemY, 0.4, lineGrey);
    }
    currentY = itemY; // ends around 450

    // ── 7. Extra KM Sub-Table ────────────────────────────────────────────────────
    currentY -= 12; // 438
    
    // A. Header Row (grey background)
    page.drawRectangle({
      x: marginLeft,
      y: currentY - 14,
      width: contentWidth,
      height: 14,
      color: rgb(0.97, 0.95, 0.93),
    });
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.6, borderGrey);
    drawLine(page, marginLeft, currentY - 14, marginRight, currentY - 14, 0.6, borderGrey);

    drawTextCentered(page, "EXTRA KM", colDescX, colRateX, currentY - 10, fontBold, 7.5, brandOrange);
    drawTextCentered(page, "RATE", colRateX, colUsageX, currentY - 10, fontBold, 7.5, brandOrange);
    drawTextCentered(page, "USAGE", colUsageX, colTotalX, currentY - 10, fontBold, 7.5, brandOrange);
    drawTextCentered(page, "TOTAL", colTotalX, endX, currentY - 10, fontBold, 7.5, brandOrange);

    // B. Data Row
    currentY -= 14; // 424
    drawLine(page, marginLeft, currentY - 18, marginRight, currentY - 18, 0.6, borderGrey);

    const hasCalculation = !!(extraKmItem && invoice.totalKm && fixKm);
    let extraKmDesc = "EXTRA KM CHARGES";
    if (hasCalculation) {
      const totalKm = invoice.totalKm;
      const baseKm = fixKm;
      const perKmPrice = extraKmItem.rate;
      const diffKm = extraKmItem.quantity;
      extraKmDesc = `(${totalKm} KM - ${baseKm} KM) = RS. ${perKmPrice} X ${diffKm} KM`;
    } else if (extraKmItem && extraKmItem.description) {
      extraKmDesc = extraKmItem.description;
    }

    // Draw data details
    drawText(page, extraKmDesc.toUpperCase(), colDescX + 10, currentY - 13, fontRegular, 8, textDark);

    const extraKmQty = extraKmItem ? String(extraKmItem.quantity) : "0";
    const extraKmRate = extraKmItem ? `Rs. ${extraKmItem.rate}` : "Rs. 0";
    const extraKmAmount = extraKmItem ? `Rs. ${extraKmItem.amount}` : "Rs. 0";

    drawTextCentered(page, extraKmRate, colRateX, colUsageX, currentY - 13, fontRegular, 8, textDark);
    drawTextCentered(page, extraKmQty, colUsageX, colTotalX, currentY - 13, fontRegular, 8, textDark);
    drawTextCentered(page, extraKmAmount, colTotalX, endX, currentY - 13, fontRegular, 8, textDark);

    currentY -= 18; // 406

    // ── 8. Side-by-Side Summary & Banking Footer ─────────────────────────────────
    currentY -= 15;
    const footerStartY = currentY;
    const footerHeight = 120;
    const footerBottom = footerStartY - footerHeight;

    // A. Left Side - Payment Info Card (Bank Details + QR Code)
    const cardWidth = 245;
    
    // Background highlight card
    page.drawRectangle({
      x: marginLeft,
      y: footerBottom,
      width: cardWidth,
      height: footerHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: lineGrey,
      borderWidth: 0.6,
    });

    // Bank Details Title Header inside card
    page.drawRectangle({
      x: marginLeft,
      y: footerStartY - 16,
      width: cardWidth,
      height: 16,
      color: brandOrange,
    });
    drawTextCentered(page, "BANK DETAILS / PAYMENT QR", marginLeft, marginLeft + cardWidth, footerStartY - 12, fontBold, 8, textLight);

    // Bank details fields (left side of card)
    const bankRows = [
      ["A/C HOLDER", business?.name || "SAFE TOURS AND TRAVELS"],
      ["BANK NAME", business?.bankName || "N/A"],
      ["ACCOUNT NO.", business?.accountNumber || "N/A"],
      ["IFSC CODE", business?.ifscCode || "N/A"],
      ["BRANCH", business?.branch || "N/A"],
    ];

    let bankY = footerStartY - 30;
    for (const [label, val] of bankRows) {
      drawText(page, label, marginLeft + 8, bankY, fontBold, 6, brandOrange);
      drawText(page, `: ${val.toUpperCase().slice(0, 22)}`, marginLeft + 75, bankY, fontRegular, 6.5, textDark);
      bankY -= 10;
    }

    // QR Code visual frame (right side of card)
    const qrSize = 65;
    const xQr = marginLeft + 172;
    const yQr = footerBottom + 20;
    
    let hasRealQr = false;

    
    // for (const ext of extensions) {
    //   const qrImagePath = path.join(assetsDir, `payment-qr${ext}`);
    //   if (fs.existsSync(qrImagePath)) {
    //     try {
    //       const qrImageBytes = fs.readFileSync(qrImagePath);
    //       let qrImage;
    //       if (ext === ".png") {
    //         qrImage = await pdfDoc.embedPng(qrImageBytes);
    //       } else {
    //         qrImage = await pdfDoc.embedJpg(qrImageBytes);
    //       }
    //       page.drawImage(qrImage, {
    //         x: xQr,
    //         y: yQr,
    //         width: qrSize,
    //         height: qrSize,
    //       });
    //       hasRealQr = true;
    //       break;
    //     } catch (err) {
    //       console.error(`Failed to embed payment-qr${ext}:`, err);
    //     }
    //   }
    // }

    // if (!hasRealQr) {
    //   // Mock QR
    //   page.drawRectangle({
    //     x: xQr,
    //     y: yQr,
    //     width: qrSize,
    //     height: qrSize,
    //     borderColor: borderGrey,
    //     borderWidth: 0.6,
    //     color: rgb(1, 1, 1),
    //   });

    //   drawQRAnchor(page, xQr + 3, yQr + qrSize - 17); // Top-Left
    //   drawQRAnchor(page, xQr + qrSize - 17, yQr + qrSize - 17); // Top-Right
    //   drawQRAnchor(page, xQr + 3, yQr + 3); // Bottom-Left
      
    //   page.drawRectangle({ x: xQr + 25, y: yQr + 25, width: 4, height: 4, color: rgb(0.1, 0.1, 0.1) });
    //   page.drawRectangle({ x: xQr + 35, y: yQr + 20, width: 5, height: 4, color: rgb(0.1, 0.1, 0.1) });
    //   page.drawRectangle({ x: xQr + 22, y: yQr + 38, width: 6, height: 3, color: rgb(0.1, 0.1, 0.1) });
    //   page.drawRectangle({ x: xQr + 40, y: yQr + 32, width: 3, height: 5, color: rgb(0.1, 0.1, 0.1) });
    // }

    // B. Right Side - Invoice Calculations & Signature
    const calcLeftX = marginLeft + 260; // 300
    const calcMiddleX = marginRight - 85; // 470
    
    // Draw totals outline box
    page.drawRectangle({
      x: calcLeftX,
      y: footerBottom + 30, // leaves 30 points at bottom for signature
      width: marginRight - calcLeftX,
      height: footerHeight - 30,
      borderColor: lineGrey,
      borderWidth: 0.6,
    });

    const calcLabels = [
      "PARKING CHARGES",
      "TOLL CHARGES",
      "SUBTOTAL",
      "SGST (2.5%)",
      "CGST (2.5%)",
      "GRAND TOTAL",
    ];

    const formatVal = (val: string | null | undefined) => {
      if (!val || val === "0") return "Rs. 0.00";
      const num = Number(val);
      if (isNaN(num)) return "Rs. 0.00";
      return `Rs. ${num.toFixed(2)}`;
    };

    const gTotal = invoice.roundoffTotal ? `Rs. ${Math.round(Number(invoice.roundoffTotal))}` : (invoice.total ? `Rs. ${Math.round(Number(invoice.total))}` : "Rs. 0");

    const calcValues = [
      formatVal(invoice.parkingCharges),
      formatVal(invoice.tollCharges),
      formatVal(invoice.subtotal),
      formatVal(invoice.sgst),
      formatVal(invoice.cgst),
      gTotal,
    ];

    let calcY = footerStartY;
    for (let i = 0; i < 6; i++) {
      const isTotal = i === 5;
      const rowHeight = 15;
      const font = isTotal ? fontBold : fontRegular;
      const size = isTotal ? 8.5 : 7.5;
      const color = isTotal ? brandOrange : textDark;

      // Draw background bar for grand total
      if (isTotal) {
        page.drawRectangle({
          x: calcLeftX,
          y: calcY - rowHeight,
          width: marginRight - calcLeftX,
          height: rowHeight,
          color: rgb(0.98, 0.92, 0.88), // peach tint
        });
      }

      // Horizontal line inside totals box
      if (i > 0) {
        drawLine(page, calcLeftX, calcY, marginRight, calcY, 0.4, lineGrey);
      }

      // Draw vertical line inside totals box
      drawLine(page, calcMiddleX, footerBottom + 30, calcMiddleX, footerStartY, 0.4, lineGrey);

      // Draw Label
      drawText(page, calcLabels[i], calcLeftX + 8, calcY - rowHeight + 3.5, font, size, color);

      // Draw Value right-aligned
      const valText = calcValues[i];
      const valWidth = font.widthOfTextAtSize(valText, size);
      drawText(page, valText, marginRight - valWidth - 8, calcY - rowHeight + 3.5, font, size, color);

      calcY -= rowHeight;
    }

    // ── 9. Amount in Words Row (Moved below calculations footer) ─────────────────
    currentY = footerBottom - 10;
    
    // Draw top and bottom horizontal line for this row
    drawLine(page, marginLeft, currentY, marginRight, currentY, 0.5, borderGrey);
    drawLine(page, marginLeft, currentY - 18, marginRight, currentY - 18, 0.5, borderGrey);
    
    // Split vertical divider
    drawLine(page, marginLeft + 90, currentY - 18, marginLeft + 90, currentY, 0.4, lineGrey);

    drawText(page, "TOTAL IN WORDS", marginLeft + 8, currentY - 13, fontBold, 7.5, brandOrange);
    drawText(page, `${invoice.totalInWords || ""} Only`.toUpperCase(), marginLeft + 98, currentY - 13, fontRegular, 8, textDark);

    currentY -= 18;

    // ── 10. Signature Area ────────────────────────────────────────────────────────
    const sigY = currentY - 20;
    const sigText = "FOR, SAFE TOURS AND TRAVELS";
    const sigTextWidth = fontBold.widthOfTextAtSize(sigText, 7.5);
    drawText(page, sigText, marginRight - sigTextWidth, sigY, fontBold, 7.5, textDark);
    
    drawLine(page, marginRight - 120, currentY - 40, marginRight, currentY - 40, 0.5, textDark);
    const authText = "AUTHORIZED SIGNATORY";
    const authTextWidth = fontRegular.widthOfTextAtSize(authText, 6.5);
    drawText(page, authText, marginRight - authTextWidth, currentY - 48, fontRegular, 6.5, textDark);

    // ── 10. Overhauled Thank You Footer Bar ────────────────────────────────────────
    page.drawRectangle({
      x: marginLeft,
      y: 40,
      width: contentWidth,
      height: 18,
      color: brandOrange,
    });
    drawTextCentered(page, "THANK YOU FOR CHOOSING US", marginLeft, marginRight, 45, fontBold, 8.5, textLight);

    // Final PDF Save
    return pdfDoc.save();
  },

  async generateStatementPdf(statementId: number, customTitle?: string): Promise<Uint8Array> {
    const statement = await statementService.getById(statementId);
    if (!statement) throw new Error("Statement not found");

    const business = await businessProfileService.get();
    const client = await clientService.getById(statement.clientId);

    const pdfDoc = await PDFDocument.create();
    
    // Sort invoices chronologically
    const invoicesList = [...(statement.invoices ?? [])].sort(
      (a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
    );

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Styling constants
    const marginLeft = 40;
    const marginRight = 802;
    const contentWidth = 762;
    const height = 595; // A4 Landscape height

    const brandOrange = rgb(0.917, 0.345, 0.047);
    const textDark = rgb(0.1, 0.1, 0.1);
    const textLight = rgb(1, 1, 1);
    const borderGrey = rgb(0.4, 0.4, 0.4);
    const tableHeaderBg = rgb(0.97, 0.95, 0.93);

    // Format number helper: strip trailing decimals if integer, keep 2 or 3 decimals otherwise
    const formatNumber = (num: number) => {
      if (num % 1 === 0) {
        return String(num);
      }
      return String(Number(num.toFixed(3)));
    };

    // Calculate sums
    const totalSubtotal = invoicesList.reduce((sum, inv) => sum + Number(inv.subtotal || 0), 0);
    const totalCgst = invoicesList.reduce((sum, inv) => sum + Number(inv.cgst || 0), 0);
    const totalSgst = invoicesList.reduce((sum, inv) => sum + Number(inv.sgst || 0), 0);
    const totalToll = invoicesList.reduce((sum, inv) => sum + Number(inv.tollCharges || 0), 0);
    const totalGrand = invoicesList.reduce((sum, inv) => sum + Number(inv.roundoffTotal || inv.total || 0), 0);

    // Pagination constants
    const firstPageMaxRows = 12;
    const otherPageMaxRows = 18;

    const colSrNoWidth = 30;
    const colDateWidth = 60;
    const colBillNoWidth = 50;
    const colJourneyDateWidth = 65;
    const colDescWidth = 145;
    const colUserWidth = 90;
    const colSubtotalWidth = 55;
    const colCgstWidth = 45;
    const colSgstWidth = 45;
    const colTollWidth = 45;
    const colTotalWidth = 60;
    const colRemarkWidth = 72;

    const xSrNo = marginLeft;
    const xDate = xSrNo + colSrNoWidth;
    const xBillNo = xDate + colDateWidth;
    const xJourneyDate = xBillNo + colBillNoWidth;
    const xDesc = xJourneyDate + colJourneyDateWidth;
    const xUser = xDesc + colDescWidth;
    const xSubtotal = xUser + colUserWidth;
    const xCgst = xSubtotal + colSubtotalWidth;
    const xSgst = xCgst + colCgstWidth;
    const xToll = xSgst + colSgstWidth;
    const xTotal = xToll + colTollWidth;
    const xRemark = xTotal + colTotalWidth;
    const xEnd = marginRight;

    const colXStarts = [xSrNo, xDate, xBillNo, xJourneyDate, xDesc, xUser, xSubtotal, xCgst, xSgst, xToll, xTotal, xRemark, xEnd];

    // Helper functions for page rendering
    function drawPageWatermark(page: PDFPage) {
      page.drawText("S", {
        x: 280,
        y: 130,
        size: 320,
        font: fontBold,
        color: brandOrange,
        opacity: 0.04,
      });
    }

    function drawPageHeader(page: PDFPage) {
      const topY = height - 40;
      page.drawRectangle({
        x: marginLeft,
        y: topY,
        width: contentWidth,
        height: 25,
        color: brandOrange,
      });

      drawText(page, "STATEMENT", marginLeft + 10, topY + 8, fontBold, 11, textLight);
      
      const gstText = `GSTIN : ${business?.gstNumber ?? "24AVZPP0095N1Z0"}`;
      const gstTextWidth = fontBold.widthOfTextAtSize(gstText, 9);
      drawText(page, gstText, marginRight - gstTextWidth - 10, topY + 8, fontBold, 9, textLight);
    }

    function drawPageFooter(page: PDFPage, pageNumber: number, totalPages: number) {
      page.drawRectangle({
        x: marginLeft,
        y: 40,
        width: contentWidth,
        height: 20,
        color: brandOrange,
      });
      drawTextCentered(page, "Thank you for choosing us", marginLeft, marginRight, 46, fontBold, 9, textLight);

      const pageText = `Page ${pageNumber} of ${totalPages}`;
      const pageTextWidth = fontRegular.widthOfTextAtSize(pageText, 7.5);
      drawText(page, pageText, marginRight - pageTextWidth, 25, fontRegular, 7.5, textDark);
    }

    function drawTableHeaderAndGrid(page: PDFPage, startY: number, rowCount: number, rowHeight: number) {
      const tableHeight = 18 + rowCount * rowHeight;
      const bottomY = startY - tableHeight;

      page.drawRectangle({
        x: marginLeft,
        y: startY - 18,
        width: contentWidth,
        height: 18,
        color: tableHeaderBg,
      });

      page.drawRectangle({
        x: marginLeft,
        y: bottomY,
        width: contentWidth,
        height: tableHeight,
        borderColor: borderGrey,
        borderWidth: 0.8,
      });

      drawLine(page, marginLeft, startY - 18, marginRight, startY - 18, 0.5, borderGrey);

      for (let r = 1; r < rowCount; r++) {
        const lineY = startY - 18 - r * rowHeight;
        drawLine(page, marginLeft, lineY, marginRight, lineY, 0.4, borderGrey);
      }

      for (let i = 1; i < colXStarts.length - 1; i++) {
        drawLine(page, colXStarts[i], bottomY, colXStarts[i], startY, 0.5, borderGrey);
      }

      const headers = ["SR NO.", "DATE", "BILL NO.", "JOURNEY DATE", "DESCRIPTION", "USERNAME", "SUBTOTAL", "CGST", "SGST", "TOLL", "TOTAL", "REMARK"];
      for (let i = 0; i < headers.length; i++) {
        drawTextCentered(page, headers[i], colXStarts[i], colXStarts[i + 1], startY - 13, fontBold, 7, brandOrange);
      }
    }

    // Split invoices into pages using robust pagination logic
    const pagesData: any[][] = [];
    let currentTempPage: any[] = [];
    
    const firstPageLimit = firstPageMaxRows - 1;
    
    for (let i = 0; i < invoicesList.length; i++) {
      currentTempPage.push(invoicesList[i]);
      
      const isFirstPage = pagesData.length === 0;
      const maxInvoiceRows = isFirstPage ? firstPageLimit : otherPageMaxRows - 1;
      
      const isLastInvoice = i === invoicesList.length - 1;
      
      if (currentTempPage.length === (isLastInvoice ? maxInvoiceRows + 1 : maxInvoiceRows)) {
        pagesData.push(currentTempPage);
        currentTempPage = [];
      }
    }
    
    if (currentTempPage.length > 0) {
      pagesData.push(currentTempPage);
    }
    if (pagesData.length === 0) {
      pagesData.push([]);
    }

    const totalPages = pagesData.length;
    let globalIndex = 0;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const page = pdfDoc.addPage([842, 595]);
      drawPageWatermark(page);
      drawPageHeader(page);

      const isPageOne = pageIdx === 0;
      const isLastPage = pageIdx === totalPages - 1;
      const pageInvoices = pagesData[pageIdx];

      let tableStartY = height - 100; // subsequent pages

      if (isPageOne) {
        // ── First Page Header Details ──
        let currentY = height - 95;
        
        // Draw Logo Symbol (Image or fallback)
        let hasRealLogo = false;
        let logoWidth = 35;
        const extensions = [".png", ".jpg", ".jpeg"];
        const assetsDir = path.join(__dirname, "../../assets");
        
        for (const ext of extensions) {
          const logoImagePath = path.join(assetsDir, `logo${ext}`);
          if (fs.existsSync(logoImagePath)) {
            try {
              const logoImageBytes = fs.readFileSync(logoImagePath);
              let logoImage;
              if (ext === ".png") {
                logoImage = await pdfDoc.embedPng(logoImageBytes);
              } else {
                logoImage = await pdfDoc.embedJpg(logoImageBytes);
              }
              logoWidth = (logoImage.width / logoImage.height) * 35;
              page.drawImage(logoImage, {
                x: marginLeft + 10,
                y: currentY - 5,
                width: logoWidth,
                height: 35,
              });
              hasRealLogo = true;
              break;
            } catch (err) {
              console.error(`Failed to embed logo${ext}:`, err);
            }
          }
        }

        if (!hasRealLogo) {
          page.drawRectangle({
            x: marginLeft + 10,
            y: currentY - 5,
            width: 35,
            height: 35,
            color: brandOrange,
          });
          drawText(page, "S", marginLeft + 21, currentY + 4, fontBold, 20, textLight);
          logoWidth = 35;
        }

        // Draw Company Name
        const companyNameX = marginLeft + 10 + logoWidth + 10;
        drawText(page, "SAFE", companyNameX, currentY + 13, fontBold, 15, brandOrange);
        drawText(page, "TOURS AND TRAVELS", companyNameX, currentY - 1, fontBold, 12, brandOrange);

        // Draw Right-aligned Company Details
        const addressLines = [
          business?.address || "1-SARDAR PATEL SOCIETY AMUL DAIRY ROAD",
          "ANAND, GUJARAT - 388001",
          `EMAIL - ${business?.email || "safetravelsk4u@gmail.com"}`,
          `PHN NO. ${business?.phone || "+91 89805 01675, +91 97260 11559"}`,
        ];

        let addrY = currentY + 22;
        for (const line of addressLines) {
          const lineWidth = fontRegular.widthOfTextAtSize(sanitizePdfText(line), 7.5);
          drawText(page, line, marginRight - lineWidth - 5, addrY, fontRegular, 7.5, textDark);
          addrY -= 11;
        }

        // Metadata grid box (Client Info & Statement info)
        currentY -= 20;
        const gridHeight = 35;
        const gridBottom = currentY - gridHeight;

        page.drawRectangle({
          x: marginLeft,
          y: gridBottom,
          width: contentWidth,
          height: gridHeight,
          borderColor: borderGrey,
          borderWidth: 0.8,
        });

        // Split inside metadata box
        const midX = 421;
        drawLine(page, midX, gridBottom, midX, currentY, 0.5, borderGrey);

        // Left Client details
        drawText(page, (client?.name ?? "").toUpperCase(), marginLeft + 10, currentY - 14, fontBold, 9, textDark);
        drawText(page, `GST No. ${client?.gstNumber ?? "N/A"}`.toUpperCase(), marginLeft + 10, currentY - 26, fontRegular, 8, textDark);

        // Right Statement details
        drawText(page, "STATEMENT NO. :", midX + 10, currentY - 14, fontBold, 8, brandOrange);
        drawTextRight(page, statement.statementNumber.toUpperCase(), marginRight - 10, currentY - 14, fontBold, 8.5, textDark);

        drawText(page, "DATE :", midX + 10, currentY - 26, fontBold, 8, brandOrange);
        drawTextRight(page, new Date(statement.statementDate).toLocaleDateString("en-IN"), marginRight - 10, currentY - 26, fontRegular, 8.5, textDark);

        // centered custom or fallback title
        currentY = gridBottom - 28;
        const printTitle = (customTitle && customTitle.trim() ? customTitle : (statement.title || "SUMMARU")).toUpperCase();
        drawTextCentered(page, printTitle, marginLeft, marginRight, currentY, fontBold, 16, textDark);

        tableStartY = currentY - 20;
      }

      // Draw table structure
      const rowCount = pageInvoices.length + (isLastPage ? 1 : 0);
      const rowHeight = 22;
      drawTableHeaderAndGrid(page, tableStartY, rowCount, rowHeight);

      // Render invoice rows
      let rowY = tableStartY - 18;
      for (let r = 0; r < pageInvoices.length; r++) {
        const inv = pageInvoices[r];
        const cellCenterY = rowY - rowHeight / 2;

        globalIndex++;

        // SR NO
        drawCellText(page, String(globalIndex), xSrNo, xDate, cellCenterY, fontRegular, 7.5, textDark);
        // DATE
        drawCellText(page, new Date(inv.invoiceDate).toLocaleDateString("en-IN"), xDate, xBillNo, cellCenterY, fontRegular, 7.5, textDark);
        // BILL NO
        drawCellText(page, formatInvoiceNumberForDisplay(inv.invoiceNumber, inv.previousInvoiceNumber), xBillNo, xJourneyDate, cellCenterY, fontBold, 7.5, textDark);
        // JOURNEY DATE
        const jDate = inv.journeyStartDate ? new Date(inv.journeyStartDate).toLocaleDateString("en-IN") : "-";
        drawCellText(page, jDate, xJourneyDate, xDesc, cellCenterY, fontRegular, 7.5, textDark);
        // DESCRIPTION
        const descriptionText = (inv.notes && inv.notes.trim() !== "")
          ? inv.notes
          : (inv.items && inv.items[0]?.description && inv.items[0].description.trim() !== "")
          ? inv.items[0].description
          : "-";
        drawCellText(page, descriptionText, xDesc, xUser, cellCenterY, fontRegular, 7.5, textDark);
        // USERNAME
        drawCellText(page, inv.username || "-", xUser, xSubtotal, cellCenterY, fontRegular, 7.5, textDark);
        // SUBTOTAL
        drawCellText(page, formatNumber(Number(inv.subtotal || 0)), xSubtotal, xCgst, cellCenterY, fontRegular, 7.5, textDark);
        // CGST
        drawCellText(page, formatNumber(Number(inv.cgst || 0)), xCgst, xSgst, cellCenterY, fontRegular, 7.5, textDark);
        // SGST
        drawCellText(page, formatNumber(Number(inv.sgst || 0)), xSgst, xToll, cellCenterY, fontRegular, 7.5, textDark);
        // TOLL
        drawCellText(page, formatNumber(Number(inv.tollCharges || 0)), xToll, xTotal, cellCenterY, fontRegular, 7.5, textDark);
        // TOTAL
        drawCellText(page, formatNumber(Number(inv.roundoffTotal || inv.total || 0)), xTotal, xRemark, cellCenterY, fontBold, 7.5, textDark);
        // REMARK
        drawCellText(page, "", xRemark, xEnd, cellCenterY, fontRegular, 7.5, textDark);

        rowY -= rowHeight;
      }

      // Draw total row if on last page
      if (isLastPage) {
        const cellCenterY = rowY - rowHeight / 2;

        // USERNAME column gets "TOTAL" label
        drawCellText(page, "TOTAL", xUser, xSubtotal, cellCenterY, fontBold, 8, brandOrange);
        // Sums in their respective columns
        drawCellText(page, formatNumber(totalSubtotal), xSubtotal, xCgst, cellCenterY, fontBold, 8, textDark);
        drawCellText(page, formatNumber(totalCgst), xCgst, xSgst, cellCenterY, fontBold, 8, textDark);
        drawCellText(page, formatNumber(totalSgst), xSgst, xToll, cellCenterY, fontBold, 8, textDark);
        drawCellText(page, formatNumber(totalToll), xToll, xTotal, cellCenterY, fontBold, 8, textDark);
        drawCellText(page, formatNumber(totalGrand), xTotal, xRemark, cellCenterY, fontBold, 8, textDark);
      }

      drawPageFooter(page, pageIdx + 1, totalPages);
    }

    return pdfDoc.save();
  },
};
