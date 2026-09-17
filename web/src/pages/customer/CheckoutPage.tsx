import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Check, ShieldCheck, Wallet, Store } from "lucide-react";
import { cartStore, useCart } from "@/lib/cartStore";
import { customerAuthStore, useCustomerAuth } from "@/lib/customerAuth";
import { customerApi, fetchPublic } from "@/lib/customerApiClient";
import { formatMoney } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { ApiError } from "@/lib/apiClient";

interface CreatedOrder {
  _id: string;
  orderNumber: number;
  subtotal: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  serviceCharge: number;
  totalAmount: number;
  orderStatus: string;
}

interface PaymentCreateResult {
  paymentId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

const inputClass =
  "h-11 w-full rounded-control border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

/** The true tax/service-charge breakdown only exists once the order is created server-side
 * (§24's price snapshot is computed from the DB menu item, never trusted from the client) —
 * so this page has two phases: enter details → place the order, then pay the real total. */
export default function CheckoutPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const auth = useCustomerAuth();
  const items = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payLater, setPayLater] = useState(false);
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // The customer session caches allowPayLater from the moment they scanned the QR code
  // (§21) — a café admin flipping the setting mid-session wouldn't otherwise be reflected
  // until the customer re-scans. Refresh it right when it matters: the payment-method choice.
  useEffect(() => {
    if (!qrToken) return;
    let cancelled = false;
    fetchPublic<{ branch: { allowPayLater: boolean } }>(`/public/tables/${qrToken}`)
      .then((ctx) => {
        if (cancelled) return;
        const current = customerAuthStore.get();
        if (current && current.qrToken === qrToken && current.allowPayLater !== ctx.branch.allowPayLater) {
          customerAuthStore.set({ ...current, allowPayLater: ctx.branch.allowPayLater });
        }
      })
      .catch(() => {
        // Best-effort refresh — keep using the session's last-known value on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  async function placeOrder() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await customerApi.post<CreatedOrder>("/customer/orders", {
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, note: i.note })),
        payLater: payLater || undefined,
      });
      if (payLater) {
        // Already sent straight to the kitchen (§23) — nothing left to pay right now.
        cartStore.clear();
        navigate(`/t/${qrToken}/orders/${created._id}`, { replace: true });
        return;
      }
      setOrder(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't place your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function pay() {
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      const payment = await customerApi.post<PaymentCreateResult>("/payments/create", { orderId: order._id });
      await openRazorpayCheckout({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        order_id: payment.providerOrderId,
        name: auth?.tenantName ?? "Yummverse",
        description: `Order #${order.orderNumber}`,
        prefill: { name: name.trim(), contact: phone.trim() || undefined },
        theme: { color: auth?.primaryColor },
        handler: (response) => {
          void (async () => {
            try {
              await customerApi.post("/payments/verify", {
                paymentId: payment.paymentId,
                providerPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              cartStore.clear();
              navigate(`/t/${qrToken}/orders/${order._id}`, { replace: true });
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Payment verification failed. Please contact staff.");
            }
          })();
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start payment. Please try again.");
      setSubmitting(false);
    }
  }

  if (items.length === 0 && !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="text-sm text-text-muted">Your cart is empty.</div>
        <button onClick={() => navigate(`/t/${qrToken}/menu`)} className="mt-2 text-sm font-semibold text-accent">
          Back to menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3.5 px-5 pb-2 pt-5">
        <button
          onClick={() => navigate(`/t/${qrToken}/cart`)}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-border bg-surface"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div className="font-display text-lg font-extrabold">Checkout</div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-[18px] shadow-sm2">
          <div className="font-display text-sm font-bold">Order Summary</div>
          {items.map((item) => (
            <div key={item.menuItemId} className="flex justify-between text-[13.5px]">
              <span className="text-text-muted">
                {item.name} &times;{item.quantity}
                {item.note && <span className="block text-[11.5px] italic text-text-muted/80">&ldquo;{item.note}&rdquo;</span>}
              </span>
              <span>{formatMoney(item.price * item.quantity, auth?.currency)}</span>
            </div>
          ))}
          <div className="h-px bg-border" />
          {order ? (
            <>
              <Row label="Subtotal" value={formatMoney(order.subtotal, auth?.currency)} />
              <Row label="CGST" value={formatMoney(order.cgstAmount || order.taxAmount / 2, auth?.currency)} />
              <Row label="SGST" value={formatMoney(order.sgstAmount || order.taxAmount / 2, auth?.currency)} />
              <Row label="Service Charge" value={formatMoney(order.serviceCharge, auth?.currency)} />
              <div className="h-px bg-border" />
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[15px] font-bold">Total</span>
                <span className="font-display text-[19px] font-extrabold">{formatMoney(order.totalAmount, auth?.currency)}</span>
              </div>
            </>
          ) : (
            <Row label="Subtotal" value={formatMoney(subtotal, auth?.currency)} />
          )}
        </div>

        {!order && auth?.allowPayLater && (
          <div className="flex flex-col gap-3">
            <div className="font-display text-[13px] font-bold text-text-muted">How would you like to pay?</div>
            <div className="grid grid-cols-2 gap-3">
              <PaymentOptionCard
                icon={<Wallet size={17} strokeWidth={1.75} />}
                label="Pay Now"
                description="Online, via card/UPI"
                selected={!payLater}
                onClick={() => setPayLater(false)}
              />
              <PaymentOptionCard
                icon={<Store size={17} strokeWidth={1.75} />}
                label="Pay at Counter"
                description="Order goes to the kitchen now; pay later"
                selected={payLater}
                onClick={() => setPayLater(true)}
              />
            </div>
          </div>
        )}

        {!order && (
          <div className="flex flex-col gap-3">
            <div className="font-display text-[13px] font-bold text-text-muted">Your details</div>
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className={inputClass} />
            </Field>
            <Field label="Phone number" hint="(optional)">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For order-ready updates"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        {error && <div className="text-sm text-danger">{error}</div>}
      </div>

      <div className="flex flex-col items-center gap-2.5 px-5 pb-8 pt-3">
        <button
          disabled={submitting}
          onClick={order ? pay : placeOrder}
          className="flex h-14 w-full items-center justify-center rounded-full bg-accent font-display text-[15.5px] font-bold text-white shadow-md2 disabled:opacity-60"
        >
          {submitting
            ? "Please wait…"
            : order
              ? `Pay ${formatMoney(order.totalAmount, auth?.currency)}`
              : payLater
                ? "Place Order"
                : "Continue"}
        </button>
        {order && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <ShieldCheck size={13} strokeWidth={2} />
            Secured by {auth?.tenantName}&rsquo;s payment gateway
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentOptionCard({
  icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-colors ${
        selected ? "border-accent bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-white">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      <span className={selected ? "text-accent" : "text-text-muted"}>{icon}</span>
      <span className="text-[13.5px] font-semibold">{label}</span>
      <span className="text-[11.5px] text-text-muted">{description}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13.5px] text-text-muted">
      <span>{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11.5px] font-semibold text-text-muted">
        {label} {required && <span className="text-accent">*</span>} {hint && <span className="font-normal">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
