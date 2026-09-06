import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Minus, Pencil, Plus } from "lucide-react";
import { cartStore, useCart } from "@/lib/cartStore";
import { useCustomerAuth } from "@/lib/customerAuth";
import { formatMoney } from "@/lib/utils";

export default function CartPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const auth = useCustomerAuth();
  const items = useCart();

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between gap-3.5 px-5 pb-1 pt-5">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate(`/t/${qrToken}/menu`)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-border bg-surface"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <div className="font-display text-lg font-extrabold">Your Order</div>
        </div>
        <div className="text-[13px] text-text-muted">Table {auth?.tableNumber}</div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {items.length === 0 && (
          <div className="py-16 text-center text-sm text-text-muted">Your cart is empty. Add something tasty from the menu.</div>
        )}
        {items.map((item, i) => (
          <div key={item.menuItemId}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{item.name}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-[13.5px] font-bold">{formatMoney(item.price * item.quantity, auth?.currency)}</div>
                <div className="flex items-center gap-2.5 rounded-full border border-border px-2 py-1">
                  <button
                    onClick={() => cartStore.setQuantity(item.menuItemId, item.quantity - 1)}
                    className="flex h-5 w-5 items-center justify-center text-text-muted"
                  >
                    <Minus size={13} strokeWidth={2} />
                  </button>
                  <span className="min-w-[10px] text-center text-[13px] font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => cartStore.setQuantity(item.menuItemId, item.quantity + 1)}
                    className="flex h-5 w-5 items-center justify-center text-text"
                  >
                    <Plus size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
            <div className="relative mt-2.5">
              <Pencil size={12} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={item.note ?? ""}
                onChange={(e) => cartStore.setNote(item.menuItemId, e.target.value)}
                placeholder="Add a note — e.g. no onions, extra spicy"
                className="h-8 w-full rounded-control border border-dashed border-border bg-bg pl-8 pr-3 text-[12px] text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:border-accent"
              />
            </div>
            {i < items.length - 1 && <div className="mt-4 h-px bg-border" />}
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-3.5 border-t border-border px-5 pb-8 pt-4">
          <div className="flex justify-between text-sm text-text-muted">
            <span>Subtotal</span>
            <span className="font-semibold text-text">{formatMoney(subtotal, auth?.currency)}</span>
          </div>
          <button
            onClick={() => navigate(`/t/${qrToken}/checkout`)}
            className="flex h-14 w-full items-center justify-center rounded-full bg-accent font-display text-[15px] font-bold text-white shadow-md2"
          >
            Checkout &middot; {formatMoney(subtotal, auth?.currency)}
          </button>
        </div>
      )}
    </div>
  );
}
