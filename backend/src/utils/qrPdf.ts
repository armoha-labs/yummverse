import PDFDocument from "pdfkit";
import { generateQrPng } from "./qr.js";

interface PrintableTable {
  tableNumber: string;
  qrToken: string;
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/** One table-tent-sized page per table, sized for printing (§22A.1). */
export async function generateTablesQrPdf(tenantName: string, tables: PrintableTable[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A6", margin: 24 });

  for (const [index, table] of tables.entries()) {
    if (index > 0) doc.addPage({ size: "A6", margin: 24 });

    const qrPng = await generateQrPng(table.qrToken);
    doc.fontSize(18).text(tenantName, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(24).text(`Table ${table.tableNumber}`, { align: "center" });
    doc.moveDown(1);
    doc.image(qrPng, { fit: [220, 220], align: "center" });
    doc.moveDown(1);
    doc.fontSize(10).text("Scan to view menu & order", { align: "center" });
  }

  return collect(doc);
}
