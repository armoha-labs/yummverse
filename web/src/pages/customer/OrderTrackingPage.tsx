import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardList, Printer } from "lucide-react";
import { customerApi } from "@/lib/customerApiClient";
import { useCustomerAuth } from "@/lib/customerAuth";
import { Receipt } from "@/components/Receipt";
import { printReceipt } from "@/lib/printReceipt";
import { registerForPushNotifications } from "@/lib/pushNotifications";

type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "NEW"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderStatusResponse {
  orderStatus: OrderStatus;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  servedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  total: number;
  note?: string;
}

interface OrderDetail extends OrderStatusResponse {
  _id: string;
  orderNumber: number;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  serviceCharge: number;
  totalAmount: number;
  createdAt: string;
}

interface Step {
  key: string;
  label: string;
  done: (o: OrderStatusResponse) => boolean;
  at?: (o: OrderStatusResponse) => string | undefined;
  /** Overrides the default "active if the previous step is done" chain — only the payment
   * step needs this, since a pay-later order (§23) can be well past this step in the kitchen
   * while still genuinely unpaid; it shouldn't read as "in progress". */
  isActive?: (o: OrderStatusResponse) => boolean;
  note?: (o: OrderStatusResponse, isPayLater: boolean) => string | undefined;
}

const STEPS: Step[] = [
  {
    key: "paid",
    label: "Payment Confirmed",
    done: (o) => o.paymentStatus === "PAID",
    isActive: (o) => o.orderStatus === "PENDING_PAYMENT",
    note: (o, isPayLater) => (isPayLater && o.paymentStatus !== "PAID" ? "Pay at counter" : undefined),
  },
  { key: "received", label: "Order Received", done: () => true },
  { key: "accepted", label: "Kitchen Accepted", done: (o) => Boolean(o.acceptedAt), at: (o) => o.acceptedAt },
  { key: "preparing", label: "Preparing", done: (o) => Boolean(o.preparingAt), at: (o) => o.preparingAt },
  { key: "ready", label: "Ready", done: (o) => Boolean(o.readyAt), at: (o) => o.readyAt },
  { key: "served", label: "Served", done: (o) => Boolean(o.servedAt), at: (o) => o.servedAt },
];

// A café with no kitchen workflow skips straight from NEW to SERVED (orderLifecycle.service.ts
// relaxes the "served" transition when kitchen is disabled) — acceptedAt/preparingAt/readyAt
// never get set, so the full 6-step tracker above would show three steps permanently stuck
// "not done". This basic version only tracks what actually happens: pay, place, serve.
const BASIC_STEPS: Step[] = [
  STEPS[0]!,
  { key: "received", label: "Order Placed", done: () => true },
  { key: "served", label: "Served", done: (o) => Boolean(o.servedAt), at: (o) => o.servedAt },
];

function timeLabel(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ qrToken: string; orderId: string }>();
  const auth = useCustomerAuth();
  const [showReceipt, setShowReceipt] = useState(false);

  const detail = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => customerApi.get<OrderDetail>(`/customer/orders/${orderId}`),
  });

  const status = useQuery({
    queryKey: ["customer-order-status", orderId],
    queryFn: () => customerApi.get<OrderStatusResponse>(`/customer/orders/${orderId}/status`),
    refetchInterval: 5000,
    enabled: Boolean(detail.data),
  });

  const current = status.data ?? detail.data;

  // Asked here rather than on landing/menu — "get notified when your order is ready" is an
  // obvious value proposition once there's an actual order to track, not before.
  useEffect(() => {
    void registerForPushNotifications(customerApi.post);
  }, []);

  if (detail.isLoading || !current) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-text-muted">Loading your order…</div>;
  }

  if (current.orderStatus === "PAYMENT_FAILED" || current.orderStatus === "CANCELLED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="font-display text-lg font-extrabold">
          {current.orderStatus === "PAYMENT_FAILED" ? "Payment failed" : "Order cancelled"}
        </div>
        <div className="text-sm text-text-muted">Please speak with a staff member for help.</div>
      </div>
    );
  }

  // The only way an order reaches the kitchen (past PENDING_PAYMENT) while still unpaid is
  // the pay-later opt-in at checkout (§23) — no separate flag needed to detect it here.
  // (PAYMENT_FAILED/CANCELLED already returned above, so orderStatus is narrowed past those.)
  const isPayLater = current.paymentStatus !== "PAID" && current.orderStatus !== "PENDING_PAYMENT";
  const kitchenEnabled = auth?.kitchenEnabled ?? true;
  const steps = kitchenEnabled ? STEPS : BASIC_STEPS;

  const heroLabel = current.servedAt
    ? "Order served — enjoy!"
    : !kitchenEnabled
      ? current.paymentStatus === "PAID" || isPayLater
        ? "Order placed — we'll bring it right out"
        : "Confirming your payment"
      : current.readyAt
        ? "Your order is ready"
        : current.preparingAt
          ? "Preparing your order"
          : current.acceptedAt
            ? "Kitchen has accepted your order"
            : current.paymentStatus === "PAID" || isPayLater
              ? "Order received — waiting for the kitchen"
              : "Confirming your payment";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-5 pb-1.5 pt-5">
        <div>
          <div className="text-xs text-text-muted">Order</div>
          <div className="font-display text-xl font-extrabold">#{detail.data?.orderNumber}</div>
        </div>
        {!current.servedAt && (
          <div className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-success" />
            Live
          </div>
        )}
      </div>

      <div className="mx-5 my-4 rounded-[20px] bg-accent px-[22px] py-[26px] text-white shadow-md2">
        <ClipboardList size={28} strokeWidth={1.75} className="mb-3" />
        <div className="font-display text-lg font-extrabold">{heroLabel}</div>
      </div>

      <div className="flex flex-1 flex-col px-6 py-1.5">
        {steps.map((step, i) => {
          const done = step.done(current);
          const isLast = i === steps.length - 1;
          const previous = steps[i - 1];
          const active = step.isActive ? step.isActive(current) : !done && (i === 0 || Boolean(previous?.done(current)));
          const note = step.note?.(current, isPayLater);
          return (
            <div key={step.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                {done ? (
                  <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success">
                    <Check size={14} strokeWidth={3} className="text-white" />
                  </div>
                ) : active ? (
                  <div className="relative h-[26px] w-[26px] shrink-0">
                    <div className="absolute inset-[-5px] rounded-full bg-accent opacity-20" />
                    <div className="absolute inset-0 rounded-full bg-accent" />
                  </div>
                ) : (
                  <div className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-border bg-surface" />
                )}
                {!isLast && <div className={`min-h-[20px] w-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`} />}
              </div>
              <div className="pb-5">
                <div className={`text-sm ${done || active ? "font-semibold text-text" : "font-medium text-text-muted"}`}>
                  {step.label}
                </div>
                {step.at?.(current) && <div className="text-xs text-text-muted">{timeLabel(step.at(current))}</div>}
                {!step.at?.(current) && note && <div className="text-xs text-text-muted">{note}</div>}
                {!step.at?.(current) && !note && active && <div className="text-xs text-text-muted">In progress</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 pb-8 pt-3.5 print:hidden">
        <div className="text-[12.5px] text-text-muted">
          Table {auth?.tableNumber} &middot; {auth?.tenantName}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReceipt((v) => !v)}
            className="rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold"
          >
            {showReceipt ? "Hide Receipt" : "View Receipt"}
          </button>
          {current.paymentStatus === "PAID" && (
            <button
              onClick={() => {
                setShowReceipt(true);
                setTimeout(() => printReceipt(), 50);
              }}
              className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-white"
            >
              <Printer size={13} strokeWidth={2} />
              Print
            </button>
          )}
        </div>
      </div>

      {detail.data && (
        <Receipt
          visible={showReceipt}
          data={{
            tenantName: auth?.tenantName ?? "",
            logoUrl: auth?.logoUrl,
            orderNumber: detail.data.orderNumber,
            createdAt: detail.data.createdAt,
            subtitle: `Table ${auth?.tableNumber ?? ""}`,
            items: detail.data.items,
            taxAmount: detail.data.taxAmount,
            cgstAmount: detail.data.cgstAmount,
            sgstAmount: detail.data.sgstAmount,
            serviceCharge: detail.data.serviceCharge,
            totalAmount: detail.data.totalAmount,
            paid: current.paymentStatus === "PAID",
            currency: auth?.currency,
          }}
        />
      )}
    </div>
  );
}
