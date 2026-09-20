import { createContext, useContext, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "./apiClient";
import { useTenantBranding } from "./useTenantBranding";
import { printReceipt as printReceiptPage } from "./printReceipt";
import { Receipt } from "@/components/Receipt";

interface OrderDetail {
  orderNumber: number;
  channel: "QR" | "POS";
  items: { name: string; quantity: number; total: number; note?: string }[];
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  serviceCharge: number;
  totalAmount: number;
  paymentStatus: string;
  createdAt: string;
}

interface PrintReceiptContextValue {
  printOrder: (orderId: string) => void;
  isPrinting: boolean;
}

const PrintReceiptContext = createContext<PrintReceiptContextValue | null>(null);

/** Owns the one admin-side <Receipt> instance. Receipt.tsx portals its printable copy into
 * a page-wide singleton #print-root — two instances mounted at once (e.g. one here, one
 * inline on the Orders page) would both write into that same node and clobber each other's
 * content — so every print trigger (the Orders page's manual button, the real-time
 * auto-print on a new order) goes through this single shared instance instead. */
export function PrintReceiptProvider({ children }: { children: ReactNode }) {
  const branding = useTenantBranding();
  const [printing, setPrinting] = useState<OrderDetail | null>(null);

  const fetchAndPrint = useMutation({
    mutationFn: (orderId: string) => api.get<OrderDetail>(`/admin/orders/${orderId}`),
    onSuccess: (order) => {
      setPrinting(order);
      setTimeout(() => printReceiptPage(), 50);
    },
  });

  function printOrder(orderId: string) {
    fetchAndPrint.mutate(orderId);
  }

  return (
    <PrintReceiptContext.Provider value={{ printOrder, isPrinting: fetchAndPrint.isPending }}>
      {children}
      {printing && (
        <Receipt
          visible={false}
          data={{
            tenantName: branding.data?.name ?? "",
            logoUrl: branding.data?.branding?.logoUrl,
            orderNumber: printing.orderNumber,
            createdAt: printing.createdAt,
            subtitle: printing.channel === "QR" ? "QR Order" : "POS",
            items: printing.items,
            taxAmount: printing.taxAmount,
            cgstAmount: printing.cgstAmount,
            sgstAmount: printing.sgstAmount,
            serviceCharge: printing.serviceCharge,
            totalAmount: printing.totalAmount,
            paid: printing.paymentStatus === "PAID",
          }}
        />
      )}
    </PrintReceiptContext.Provider>
  );
}

export function usePrintReceipt(): PrintReceiptContextValue {
  const ctx = useContext(PrintReceiptContext);
  if (!ctx) throw new Error("usePrintReceipt must be used within a PrintReceiptProvider");
  return ctx;
}
