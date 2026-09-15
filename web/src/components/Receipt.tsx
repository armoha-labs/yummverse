import { ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export interface ReceiptItem {
  name: string;
  quantity: number;
  total: number;
  note?: string;
}

export interface ReceiptData {
  /** The receipt's title — this café's name, not a generic "Receipt" heading. */
  tenantName: string;
  /** Same branding.logoUrl shown on the login page and the PDF report export — undefined
   * cafés just get the text title with no image, same as those two surfaces. */
  logoUrl?: string;
  orderNumber: number;
  createdAt: string;
  /** e.g. "Table 3" or "POS" — no café name here anymore, that's now the title above it. */
  subtitle: string;
  items: ReceiptItem[];
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  paid: boolean;
  currency?: string;
}

/** Matches the global `@media print` rule in index.css, which prints only this element. */
export const RECEIPT_PRINT_AREA_ID = "receipt-print-area";

/** A café's printable receipt (§23A.5's "browser print API for a basic setup") — used both
 * by the customer's order-tracking page and by staff reprinting a bill from the Orders page.
 * `visible` controls on-screen display only; it always renders (and is always printable) so
 * a caller can trigger `window.print()` right after setting the data. */
export function Receipt({ data, visible }: { data: ReceiptData; visible: boolean }) {
  return (
    <div
      id={RECEIPT_PRINT_AREA_ID}
      // Always laid out (never display:none) so printReceipt.ts's scrollHeight measurement
      // is accurate even when this is "invisible" on screen — display:none would zero it out
      // before the print media query ever gets a chance to override it back to visible,
      // causing the printed receipt to split across several under-sized pages. When
      // `visible` is false it's moved off-canvas via position instead, which keeps it
      // rendered (and measurable) without showing on screen. A fixed 88mm width, applied in
      // both states, keeps line-wrapping identical between the on-screen measurement and the
      // actual print output.
      className={`flex flex-col gap-2 rounded-2xl border border-border bg-surface p-[18px] shadow-sm2 print:static print:rounded-none print:border-none print:shadow-none ${
        visible ? "static mx-5 mb-8" : "fixed left-[-9999px] top-0"
      }`}
      style={{ width: "88mm" }}
    >
      {data.logoUrl && <img src={data.logoUrl} alt="" className="mx-auto h-10 w-10 rounded object-contain" />}
      <div className="text-center font-display text-base font-extrabold">{data.tenantName}</div>
      <div className="mb-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        <ShoppingBag size={12} strokeWidth={1.75} className="print:hidden" /> Receipt
      </div>
      <div className="mb-1 text-center text-[12px] text-text-muted">
        {data.subtitle}
        <br />
        Order #{data.orderNumber} &middot; {new Date(data.createdAt).toLocaleString()}
      </div>
      {data.items.map((item, i) => (
        <div key={i} className="flex justify-between text-[13px]">
          <span className="text-text-muted">
            {item.name} &times;{item.quantity}
            {item.note && <span className="block text-[11px] italic">&ldquo;{item.note}&rdquo;</span>}
          </span>
          <span>{formatMoney(item.total, data.currency)}</span>
        </div>
      ))}
      <div className="h-px bg-border" />
      <div className="flex justify-between text-[13px] text-text-muted">
        <span>Tax</span>
        <span>{formatMoney(data.taxAmount, data.currency)}</span>
      </div>
      <div className="flex justify-between text-[13px] text-text-muted">
        <span>Service Charge</span>
        <span>{formatMoney(data.serviceCharge, data.currency)}</span>
      </div>
      <div className="flex justify-between font-display text-sm font-extrabold">
        <span>Total</span>
        <span>{formatMoney(data.totalAmount, data.currency)}</span>
      </div>
      <div className="mt-1 text-center text-[11px] text-text-muted">
        Payment {data.paid ? "received" : "pending"} &middot; Thank you!
      </div>
    </div>
  );
}
