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

export function toPdf(title: string, rows: ExportRow[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const promise = collect(doc as unknown as Writable);

  doc.fontSize(16).text(title);
  doc.moveDown();

  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  doc.fontSize(9).text(headers.join("  |  "));
  doc.moveDown(0.5);
  for (const row of rows) {
    doc.text(headers.map((h) => String(row[h] ?? "")).join("  |  "));
  }

  doc.end();
  return promise;
}
