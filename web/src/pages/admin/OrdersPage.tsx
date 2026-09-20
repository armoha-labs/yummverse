import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api, ApiError } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Receipt } from "@/components/Receipt";
import { printReceipt as printReceiptPage } from "@/lib/printReceipt";
import { useTenantBranding } from "@/lib/useTenantBranding";
import { useTenantSettings } from "@/lib/useTenantSettings";
import { orderStatusLabel } from "@/lib/orderStatus";

interface OrderRow {
  _id: string;
  branchId: string;
  orderNumber: number;
  channel: "QR" | "POS";
  items: { name: string; quantity: number }[];
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

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

const STATUSES = [
  "PENDING_PAYMENT",
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "PAYMENT_FAILED",
];

const CANCELLABLE = new Set(["NEW", "ACCEPTED", "PREPARING"]);
const NOT_COLLECTIBLE = new Set(["CANCELLED", "REFUND_PENDING", "REFUNDED"]);
// With no kitchen workflow, an order never reaches READY on its own — any of these active
// statuses can be marked Served directly (mirrors orderLifecycle.service.ts's relaxed guard).
const SERVABLE_WHEN_KITCHEN_DISABLED = new Set(["NEW", "ACCEPTED", "PREPARING", "READY"]);
// These statuses can never happen going forward once kitchen is off — no point offering them
// as filter options (a straggler order already in one of these before the toggle flipped
// still shows up fine under "All statuses").
const KITCHEN_ONLY_STATUSES = new Set(["ACCEPTED", "PREPARING", "READY"]);

const STATUS_VARIANT: Record<string, "default" | "success" | "secondary" | "outline" | "danger"> = {
  PENDING_PAYMENT: "outline",
  NEW: "secondary",
  ACCEPTED: "default",
  PREPARING: "default",
  READY: "success",
  SERVED: "outline",
  COMPLETED: "outline",
  PAYMENT_FAILED: "danger",
  CANCELLED: "danger",
  REFUND_PENDING: "danger",
  REFUNDED: "outline",
};

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function OrdersPage() {
  const [status, setStatus] = useState<string>("");
  const [collecting, setCollecting] = useState<OrderRow | null>(null);
  const [printing, setPrinting] = useState<OrderDetail | null>(null);
  const queryClient = useQueryClient();
  const branding = useTenantBranding();
  const settings = useTenantSettings();
  const kitchenEnabled = settings.data?.ordering.kitchenEnabled ?? true;

  const visibleStatuses = kitchenEnabled ? STATUSES : STATUSES.filter((s) => !KITCHEN_ONLY_STATUSES.has(s));

  const orders = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: () => api.get<OrderRow[]>(`/admin/orders${status ? `?status=${status}` : ""}`),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/admin/orders/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const markServed = useMutation({
    mutationFn: (id: string) => api.post(`/admin/kitchen/orders/${id}/served`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const printReceipt = useMutation({
    mutationFn: (id: string) => api.get<OrderDetail>(`/admin/orders/${id}`),
    onSuccess: (order) => {
      setPrinting(order);
      setTimeout(() => printReceiptPage(), 50);
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Orders</h1>
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {visibleStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {orderStatusLabel(s, kitchenEnabled)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[90px_85px_1fr_100px_170px_120px_230px] gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              <div>Order</div>
              <div>Channel</div>
              <div>Items</div>
              <div>Total</div>
              <div>Status</div>
              <div>Payment</div>
              <div />
            </div>
            {orders.isLoading && <div className="px-5 py-8 text-center text-sm text-text-muted">Loading…</div>}
            {orders.data?.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-muted">No orders match this filter.</div>
            )}
            {orders.data?.map((order) => (
              <div
                key={order._id}
                className="grid grid-cols-[90px_85px_1fr_100px_170px_120px_230px] items-center gap-2 border-t border-border px-5 py-3 text-sm"
              >
                <div className="font-semibold">#{order.orderNumber}</div>
                <div className="text-text-muted">{order.channel}</div>
                <div className="truncate text-text-muted">{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
                <div className="font-semibold">{currency(order.totalAmount)}</div>
                <div>
                  <Badge variant={STATUS_VARIANT[order.orderStatus] ?? "outline"}>
                    {orderStatusLabel(order.orderStatus, kitchenEnabled)}
                  </Badge>
                </div>
                <div className="text-text-muted">{order.paymentStatus}</div>
                <div className="flex items-center gap-1">
                  {order.paymentStatus !== "PAID" && !NOT_COLLECTIBLE.has(order.orderStatus) && (
                    <Button size="sm" variant="outline" onClick={() => setCollecting(order)}>
                      Collect Payment
                    </Button>
                  )}
                  {!kitchenEnabled && SERVABLE_WHEN_KITCHEN_DISABLED.has(order.orderStatus) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markServed.isPending}
                      onClick={() => markServed.mutate(order._id)}
                    >
                      Mark Served
                    </Button>
                  )}
                  {CANCELLABLE.has(order.orderStatus) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(order._id)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={printReceipt.isPending}
                    onClick={() => printReceipt.mutate(order._id)}
                    title="Print receipt"
                  >
                    <Printer size={14} strokeWidth={2} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CollectPaymentDialog order={collecting} onClose={() => setCollecting(null)} />

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
    </div>
  );
}

function CollectPaymentDialog({ order, onClose }: { order: OrderRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<"CASH" | "POS_CARD">("CASH");
  const [error, setError] = useState<string | null>(null);

  const posSettings = useQuery({
    queryKey: ["pos-settings", order?.branchId],
    queryFn: () => api.get<{ posCardEnabled: boolean }>(`/pos/settings?branchId=${order!.branchId}`),
    enabled: Boolean(order),
  });
  // Card (POS terminal) only shows up once this order's branch actually has it enabled
  // (Settings → Operations, or a per-branch override) — see PosOrderPage.tsx for why.
  const paymentMethods = (["CASH", "POS_CARD"] as const).filter(
    (m) => m !== "POS_CARD" || posSettings.data?.posCardEnabled,
  );

  const collect = useMutation({
    mutationFn: () => api.post(`/pos/orders/${order!._id}/pay`, { method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      handleClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't record this payment."),
  });

  function handleClose() {
    setMethod("CASH");
    setError(null);
    onClose();
  }

  if (!order) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Order #{order.orderNumber} · {currency(order.totalAmount)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {paymentMethods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-control border px-3 py-2.5 text-sm font-semibold ${
                method === m ? "border-accent bg-accent-soft text-accent" : "border-border bg-bg text-text-muted"
              }`}
            >
              {m === "CASH" ? "Cash" : "Card (POS terminal)"}
            </button>
          ))}
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={collect.isPending} onClick={() => collect.mutate()}>
            {collect.isPending ? "Recording…" : "Mark as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
