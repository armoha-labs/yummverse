import { Writable } from "node:stream";
import { format as formatCsv } from "fast-csv";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export type ExportRow = Record<string, string | number | boolean | null | undefined>;

function collect(stream: Writable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export function toCsv(rows: ExportRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const csvStream = formatCsv({ headers: true });
    csvStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    csvStream.on("end", () => resolve(Buffer.concat(chunks)));
    csvStream.on("error", reject);
    for (const row of rows) csvStream.write(row);
    csvStream.end();
  });
}

export async function toExcel(rows: ExportRow[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  sheet.columns = headers.map((key) => ({ header: key, key, width: 18 }));
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface PdfReportHeader {
  tenantName: string;
  reportTitle: string;
  dateFrom: Date;
  dateTo: Date;
  /** Undefined when the tenant has no logo, or it couldn't be fetched — the header still
   * renders correctly without one, just without the image. */
  logo?: Buffer;
}

const ACRONYMS = ["cgst", "sgst", "gst"];

function humanizeHeader(key: string): string {
  // camelCase -> "Camel Case"
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  return spaced
    .split(" ")
    .map((word) => (ACRONYMS.includes(word.toLowerCase()) ? word.toUpperCase() : word))
    .join(" ");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 20;
const HEADER_LOGO_SIZE = 44;

export function toPdf(header: PdfReportHeader, rows: ExportRow[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const promise = collect(doc as unknown as Writable);

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const contentBottom = doc.page.height - PAGE_MARGIN;

  function drawPageHeader(): void {
    const topY = doc.y;
    const hasLogo = Boolean(header.logo);
    if (header.logo) {
      try {
        doc.image(header.logo, PAGE_MARGIN, topY, { fit: [HEADER_LOGO_SIZE, HEADER_LOGO_SIZE] });
      } catch {
        // Corrupt/unsupported image data — fall through to a text-only header.
      }
    }
    const textX = hasLogo ? PAGE_MARGIN + HEADER_LOGO_SIZE + 14 : PAGE_MARGIN;
    const textWidth = contentWidth - (textX - PAGE_MARGIN);
    doc.fontSize(15).fillColor("#111111").font("Helvetica-Bold").text(header.tenantName, textX, topY, { width: textWidth });
    doc.fontSize(11).fillColor("#444444").font("Helvetica").text(header.reportTitle, textX, doc.y, { width: textWidth });
    doc
      .fontSize(9)
      .fillColor("#888888")
      .text(`${formatDate(header.dateFrom)} – ${formatDate(header.dateTo)}`, textX, doc.y, { width: textWidth });

    doc.y = Math.max(doc.y, topY + HEADER_LOGO_SIZE) + 14;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + contentWidth, doc.y).strokeColor("#dddddd").stroke();
    doc.y += 14;
  }

  drawPageHeader();

  const keys = rows.length > 0 ? Object.keys(rows[0]!) : [];
  const colWidth = contentWidth / Math.max(keys.length, 1);

  function drawRow(values: string[], opts: { bold?: boolean; shaded?: boolean } = {}): void {
    const y = doc.y;
    if (opts.shaded) {
      doc.rect(PAGE_MARGIN, y - 4, contentWidth, ROW_HEIGHT).fillColor("#f7f7f7").fill();
    }
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(opts.bold ? "#111111" : "#333333");
    values.forEach((value, i) => {
      doc.text(value, PAGE_MARGIN + i * colWidth, y, { width: colWidth - 8, ellipsis: true });
    });
    doc.y = y + ROW_HEIGHT;
  }

  function ensureSpace(): void {
    if (doc.y + ROW_HEIGHT > contentBottom) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
      drawPageHeader();
      drawRow(keys.map(humanizeHeader), { bold: true, shaded: true });
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + contentWidth, doc.y).strokeColor("#dddddd").stroke();
      doc.y += 4;
    }
  }

  if (keys.length > 0) {
    drawRow(keys.map(humanizeHeader), { bold: true, shaded: true });
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + contentWidth, doc.y).strokeColor("#dddddd").stroke();
    doc.y += 4;
  }

  for (const row of rows) {
    ensureSpace();
    drawRow(keys.map((k) => String(row[k] ?? "")));
  }

  if (rows.length === 0) {
    doc.fontSize(10).fillColor("#999999").font("Helvetica").text("No data in this period.", PAGE_MARGIN, doc.y);
  }

  doc.end();
  return promise;
}
