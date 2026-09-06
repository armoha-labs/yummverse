import PDFDocument from "pdfkit";

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  tenantName: string;
  planId: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  issuedAt: Date;
}

function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function date(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** A subscription billing statement from Yummverse to the café (§47A) — distinct from the
 * café's own customer-facing order receipt (§23A.5). */
export async function generateSubscriptionInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(20).text("Yummverse", { continued: true }).fontSize(11).text("  Subscription Invoice", { align: "left" });
  doc.moveDown(1.5);

  doc.fontSize(10).fillColor("#666666");
  doc.text(`Invoice Number: ${input.invoiceNumber}`);
  doc.text(`Issued: ${date(input.issuedAt)}`);
  doc.moveDown(1);

  doc.fillColor("#111111").fontSize(12).text("Billed To");
  doc.fillColor("#333333").fontSize(11).text(input.tenantName);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  doc.fontSize(10).fillColor("#666666");
  doc.text("Description", 50, tableTop);
  doc.text("Period", 260, tableTop);
  doc.text("Amount", 440, tableTop, { width: 100, align: "right" });
  doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).strokeColor("#dddddd").stroke();

  const rowY = tableTop + 26;
  doc.fillColor("#111111").fontSize(11);
  doc.text(`${input.planId} plan subscription`, 50, rowY, { width: 200 });
  doc.text(`${date(input.periodStart)} - ${date(input.periodEnd)}`, 260, rowY, { width: 170 });
  doc.text(money(input.amount, input.currency), 440, rowY, { width: 100, align: "right" });

  doc.moveTo(50, rowY + 30).lineTo(545, rowY + 30).strokeColor("#dddddd").stroke();
  doc.fontSize(12).fillColor("#111111").text("Total", 340, rowY + 42, { width: 100, align: "right" });
  doc.fontSize(12).text(money(input.amount, input.currency), 440, rowY + 42, { width: 100, align: "right" });

  doc.moveDown(4);
  doc
    .fontSize(9)
    .fillColor("#999999")
    .text(
      "This is a billing statement for platform subscription fees. It is unrelated to any payments collected from your own customers.",
      50,
      doc.y,
      { width: 495 },
    );

  return collect(doc);
}
