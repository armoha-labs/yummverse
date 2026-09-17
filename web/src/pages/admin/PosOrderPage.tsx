import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Branch {
  _id: string;
  name: string;
  isDefault: boolean;
}

interface Category {
  _id: string;
  name: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  taxPercentage: number;
  isAvailable: boolean;
}

interface Table {
  _id: string;
  tableNumber: string;
  status: string;
}

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CreatedOrder {
  _id: string;
  orderNumber: number;
  totalAmount: number;
}

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** §23A.2's counter-ordering flow — a Tenant Admin keying in a walk-in order themselves
 * rather than the customer's own QR device. Same POS endpoints a Waiter would use; this
 * screen just also lets the admin pick a branch, since admin sessions aren't branch-locked
 * the way a Waiter's token is. */
export default function PosOrderPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [tableId, setTableId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [method, setMethod] = useState<"CASH" | "POS_CARD">("CASH");
  const [error, setError] = useState<string | null>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<Branch[]>("/admin/branches") });
  const isMultiBranch = (branches.data?.length ?? 0) > 1;
  const effectiveBranchId = branchId || branches.data?.find((b) => b.isDefault)?._id || branches.data?.[0]?._id || "";

  const categories = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/admin/categories") });
  const menu = useQuery({
    queryKey: ["pos-menu", effectiveBranchId],
    queryFn: () => api.get<MenuItem[]>(`/pos/menu?branchId=${effectiveBranchId}`),
    enabled: Boolean(effectiveBranchId),
  });
  const tables = useQuery({
    queryKey: ["pos-tables", effectiveBranchId],
    queryFn: () => api.get<Table[]>(`/admin/tables?branchId=${effectiveBranchId}`),
    enabled: Boolean(effectiveBranchId),
  });

  const searching = search.trim().length > 0;
  const filtered = (menu.data ?? []).filter((item) => {
    // A search query searches the whole menu regardless of the category tab — a cashier
    // looking up an item shouldn't have to first find the right tab.
    if (searching) return item.name.toLowerCase().includes(search.trim().toLowerCase());
    return selectedCategory === "all" || item.categoryId === selectedCategory;
  });

  function addItem(item: MenuItem) {
    setCart((c) => {
      const existing = c.find((l) => l.menuItemId === item.id);
      if (existing) return c.map((l) => (l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function setQty(menuItemId: string, quantity: number) {
    setCart((c) =>
      quantity <= 0
        ? c.filter((l) => l.menuItemId !== menuItemId)
        : c.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l)),
    );
  }

  function resetForNextOrder() {
    setCart([]);
    setTableId("");
    setCreatedOrder(null);
    setMethod("CASH");
    setError(null);
  }

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  const placeOrder = useMutation({
    mutationFn: () =>
      api.post<CreatedOrder>("/pos/orders", {
        items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        tableId: tableId || undefined,
        branchId: isMultiBranch ? effectiveBranchId : undefined,
      }),
    onSuccess: (order) => {
      setCreatedOrder(order);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't place this order."),
  });

  const collectPayment = useMutation({
    mutationFn: () => api.post(`/pos/orders/${createdOrder!._id}/pay`, { method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      resetForNextOrder();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't record this payment."),
  });

  // Payment-collection step for the order just created — same two settlement paths
  // OrdersPage's "Collect Payment" dialog offers for an existing order.
  if (createdOrder) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Collect Payment</h1>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6 shadow-sm2">
          <div className="text-sm text-text-muted">Order #{createdOrder.orderNumber}</div>
          <div className="font-display text-3xl font-extrabold">{currency(createdOrder.totalAmount)}</div>

          <div className="mt-2 flex gap-2">
            {(["CASH", "POS_CARD"] as const).map((m) => (
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

          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={resetForNextOrder}>
              New Order Instead
            </Button>
            <Button className="flex-1" disabled={collectPayment.isPending} onClick={() => collectPayment.mutate()}>
              {collectPayment.isPending ? "Recording…" : "Mark as Paid"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold">New Counter Order</h1>
          <div className="flex flex-wrap gap-2">
            {isMultiBranch && (
              <Select value={effectiveBranchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.data?.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={tableId || "TAKEAWAY"} onValueChange={(v) => setTableId(v === "TAKEAWAY" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TAKEAWAY">Takeaway</SelectItem>
                {tables.data?.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    Table {t.tableNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items…"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className={`flex gap-2 overflow-x-auto pb-1 ${searching ? "pointer-events-none opacity-40" : ""}`}>
          <button
            onClick={() => setSelectedCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${
              selectedCategory === "all" ? "bg-accent text-white" : "border border-border text-text-muted"
            }`}
          >
            All
          </button>
          {categories.data?.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${
                selectedCategory === cat._id ? "bg-accent text-white" : "border border-border text-text-muted"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const line = cart.find((l) => l.menuItemId === item.id);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-3.5 shadow-sm2"
                style={{ opacity: item.isAvailable ? 1 : 0.5 }}
              >
                <div className="text-[13.5px] font-semibold">{item.name}</div>
                <div className="text-xs text-text-muted">{item.isAvailable ? currency(item.price) : "Sold out"}</div>
                {item.isAvailable &&
                  (line ? (
                    <div className="mt-1 flex items-center justify-between rounded-full border border-border px-2 py-1">
                      <button onClick={() => setQty(item.id, line.quantity - 1)} className="flex h-5 w-5 items-center justify-center text-text-muted">
                        <Minus size={13} strokeWidth={2} />
                      </button>
                      <span className="text-[13px] font-semibold">{line.quantity}</span>
                      <button onClick={() => addItem(item)} className="flex h-5 w-5 items-center justify-center text-text">
                        <Plus size={13} strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => addItem(item)}>
                      Add
                    </Button>
                  ))}
              </div>
            );
          })}
          {menu.isSuccess && filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-text-muted">
              {searching ? `No items match "${search.trim()}".` : "No items in this category."}
            </div>
          )}
        </div>
      </div>

      {/* order-first so the total/Place Order button is reachable without scrolling past the
          whole menu grid on mobile (below lg, this panel stacks under the menu in DOM order);
          sticky keeps it in view while scrolling either the menu grid below it (mobile) or a
          long cart (desktop's side column). */}
      <div className="sticky top-0 z-10 order-first flex max-h-[calc(100vh-2rem)] w-full flex-none flex-col gap-3 rounded-card border border-border bg-surface p-[18px] shadow-sm2 lg:order-none lg:w-72">
        <div className="flex items-center gap-2 font-display text-sm font-bold">
          <ShoppingCart size={16} strokeWidth={1.75} /> Order ({cartCount})
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {cart.length === 0 && <div className="py-8 text-center text-xs text-text-muted">No items yet — tap a menu item to add it.</div>}
          {cart.map((l) => (
            <div key={l.menuItemId} className="flex justify-between text-[13px]">
              <span className="text-text-muted">
                {l.name} ×{l.quantity}
              </span>
              <span className="font-semibold">{currency(l.price * l.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Subtotal</span>
            <span className="font-semibold">{currency(subtotal)}</span>
          </div>
          <div className="mt-1 text-[11px] text-text-muted">Tax/service charge applied at checkout.</div>
        </div>

        {error && <div className="text-xs text-danger">{error}</div>}

        <Button disabled={cart.length === 0 || placeOrder.isPending} onClick={() => placeOrder.mutate()}>
          {placeOrder.isPending ? "Placing…" : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
