import { createPortal } from "react-dom";
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
  /** CGST/SGST — India's GST split for intra-state supply. Optional so callers on an older
   * order shape still render (falling back to an even split of taxAmount below). */
  cgstAmount?: number;
  sgstAmount?: number;
  serviceCharge: number;
  totalAmount: number;
  paid: boolean;
  currency?: string;
}

/** Matches the global `@media print` rule in index.css, which prints only this element. */
export const RECEIPT_PRINT_AREA_ID = "receipt-print-area";
const PRINT_ROOT_ID = "print-root";

/** A dedicated DOM node that's a sibling of #root, not a descendant — so the print CSS can
 * hide the entire app (`#root { display: none }`) with zero leftover layout space, instead
 * of the old `visibility: hidden` trick, which kept every hidden element's box (the whole
 * page behind the receipt — sidebar, tables, everything) contributing to the document's
 * height. Chrome's print engine reflows overflowing content onto extra pages rather than
 * clipping it, even under `overflow: hidden`, so that leftover height turned into a blank
 * trailing page. Living outside #root, the receipt is unaffected by hiding it. */
function getPrintRoot(): HTMLElement {
  let el = document.getElementById(PRINT_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = PRINT_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

function ReceiptBody({ data }: { data: ReceiptData }) {
  return (
    <>
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
        <span>CGST</span>
        {/* || not ?? — a pre-GST-split order has cgstAmount 0 (schema default) despite a real
            taxAmount, so fall back to an even split; when tax is genuinely 0 the fallback is
            also 0, so this is safe either way. */}
        <span>{formatMoney(data.cgstAmount || data.taxAmount / 2, data.currency)}</span>
      </div>
      <div className="flex justify-between text-[13px] text-text-muted">
        <span>SGST</span>
        <span>{formatMoney(data.sgstAmount || data.taxAmount / 2, data.currency)}</span>
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
    </>
  );
}

/** A café's printable receipt (§23A.5's "browser print API for a basic setup") — used both
 * by the customer's order-tracking page and by staff reprinting a bill from the Orders page.
 * `visible` controls an on-screen inline preview only (rendered in its normal place in the
 * page); the actual printable copy always renders into a separate portal (see getPrintRoot)
 * so printing never depends on — or is derailed by — whatever else is on screen. */
export function Receipt({ data, visible }: { data: ReceiptData; visible: boolean }) {
  return (
    <>
      {visible && (
        <div className="mx-5 mb-8 flex flex-col gap-2 rounded-2xl border border-border bg-surface p-[18px] shadow-sm2">
          <ReceiptBody data={data} />
        </div>
      )}
      {createPortal(
        <div
          id={RECEIPT_PRINT_AREA_ID}
          // Off-canvas rather than display:none so printReceipt.ts's scrollHeight
          // measurement is always accurate (a display:none element measures 0). A fixed
          // 88mm width matches the print CSS's width exactly, so line-wrapping — and thus
          // the measured height — is identical between measurement time and print time.
          className="fixed left-[-9999px] top-0 flex flex-col gap-2"
          style={{ width: "88mm" }}
        >
          <ReceiptBody data={data} />
        </div>,
        getPrintRoot(),
      )}
    </>
  );
}
