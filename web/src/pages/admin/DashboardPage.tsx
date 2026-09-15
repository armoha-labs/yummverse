import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardSummary {
  last7Days: {
    grossRevenue: number;
    netRevenue: number;
    orderCount: number;
    averageOrderValue: number;
    grossRevenueChangePct: number | null;
  };
  activeOrderCount: number;
  tables: { total: number; occupied: number; available: number };
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface OrderRow {
  _id: string;
  orderNumber: number;
  tableId?: string;
  items: OrderItem[];
  totalAmount: number;
  orderStatus: string;
  createdAt: string;
}

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

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

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardSummary>("/admin/dashboard"),
  });
  const orders = useQuery({
    queryKey: ["admin-orders", "recent"],
    queryFn: () => api.get<OrderRow[]>("/admin/orders"),
  });

  const recentOrders = (orders.data ?? []).slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">Dashboard</h1>
        <div className="text-sm text-text-muted">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Revenue (7 days)"
          value={summary.data ? currency(summary.data.last7Days.grossRevenue) : "—"}
          delta={summary.data?.last7Days.grossRevenueChangePct}
        />
        <StatCard label="Orders (7 days)" value={summary.data?.last7Days.orderCount ?? "—"} />
        <StatCard label="Active Orders" value={summary.data?.activeOrderCount ?? "—"} />
        <StatCard
          label="Tables"
          value={summary.data ? `${summary.data.tables.occupied} / ${summary.data.tables.total}` : "—"}
          hint={summary.data ? `${summary.data.tables.available} available` : undefined}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="border-b border-border px-5 py-4 font-display text-sm font-bold">Live Orders</div>
        <div className="overflow-x-auto">
          <div className="min-w-[650px]">
            <div className="grid grid-cols-[90px_1fr_100px_170px_90px] gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              <div>Order</div>
              <div>Items</div>
              <div>Total</div>
              <div>Status</div>
              <div>Time</div>
            </div>
            {recentOrders.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-text-muted">No orders yet.</div>
            )}
            {recentOrders.map((order) => (
              <div
                key={order._id}
                className="grid grid-cols-[90px_1fr_100px_170px_90px] gap-2 items-center border-t border-border px-5 py-3 text-sm"
              >
                <div className="font-semibold">#{order.orderNumber}</div>
                <div className="truncate text-text-muted">
                  {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                </div>
                <div className="font-semibold">{currency(order.totalAmount)}</div>
                <div>
                  <Badge variant={STATUS_VARIANT[order.orderStatus] ?? "outline"}>{order.orderStatus}</Badge>
                </div>
                <div className="text-text-muted">{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-[18px] shadow-sm2">
      <div className="text-[12.5px] font-semibold text-text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={cn("mt-1 text-xs font-semibold", delta >= 0 ? "text-success" : "text-danger")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}% vs previous period
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}
