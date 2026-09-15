import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { api } from "@/lib/apiClient";
import { useAuth, logout } from "@/lib/auth";
import { useStaffBranding } from "@/lib/useTenantBranding";
import { useNavigate } from "react-router-dom";
import { registerForPushNotifications } from "@/lib/pushNotifications";

interface OrderItem {
  name: string;
  quantity: number;
  note?: string;
}

interface OrderRow {
  _id: string;
  orderNumber: number;
  tableId?: { tableNumber: string } | null; // populated with just the number (§10)
  items: OrderItem[];
  orderStatus: "NEW" | "ACCEPTED" | "PREPARING" | "READY";
  createdAt: string;
}

const COLUMNS: { status: OrderRow["orderStatus"]; label: string; action?: string; next?: string }[] = [
  { status: "NEW", label: "New", action: "Accept", next: "accept" },
  { status: "ACCEPTED", label: "Accepted", action: "Start Preparing", next: "preparing" },
  { status: "PREPARING", label: "Preparing", action: "Mark Ready", next: "ready" },
  { status: "READY", label: "Ready", action: undefined, next: undefined },
];

function elapsedLabel(createdAt: string, now: number): string {
  const minutes = Math.floor((now - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

export default function KitchenDisplayPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const branding = useStaffBranding();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    void registerForPushNotifications(api.post);
  }, []);

  const orders = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: () => api.get<OrderRow[]>("/kitchen/orders"),
    refetchInterval: 5000,
  });

  const advance = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/kitchen/orders/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  async function onLogout() {
    await logout();
    navigate(`/${auth?.tenantSlug ?? ""}/kitchen/login`, { replace: true });
  }

  const activeCount = orders.data?.length ?? 0;

  return (
    <div className="flex h-screen flex-col bg-bg font-body text-text">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-7 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-accent font-display text-[13px] font-extrabold text-white">
            {(branding.data?.name ?? "K").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-base font-extrabold">Kitchen Display</div>
            <div className="text-[11.5px] text-text-muted">{branding.data?.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-1.5 text-xs font-bold text-success">
          <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-success" />
          Live · {activeCount} active order{activeCount === 1 ? "" : "s"}
        </div>

        <div className="flex items-center gap-4">
          <div className="font-display text-[15px] font-bold">
            {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button
            onClick={onLogout}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-bg text-text-muted hover:text-text"
          >
            <LogOut size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
        {COLUMNS.map((col) => {
          const columnOrders = (orders.data ?? []).filter((o) => o.orderStatus === col.status);
          return (
            <div key={col.status} className="flex w-[280px] min-w-[280px] flex-1 flex-col gap-3 overflow-y-auto lg:w-auto">
              <div className="flex items-center gap-2">
                <div className="font-display text-[13.5px] font-bold">{col.label}</div>
                <div className="rounded-full bg-secondary-soft px-2.5 py-0.5 text-[11px] font-bold text-text">
                  {columnOrders.length}
                </div>
              </div>

              {columnOrders.map((order) => (
                <div key={order._id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-sm2">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-[14.5px] font-extrabold">#{order.orderNumber}</div>
                    <div className="text-[11px] font-semibold text-text-muted">
                      {order.tableId ? `Table ${order.tableId.tableNumber}` : "Takeaway"}
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex flex-col gap-1 text-xs">
                    {order.items.map((item, i) => (
                      <div key={i}>
                        {item.quantity}× {item.name}
                        {item.note && <span className="text-text-muted"> — {item.note}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-text-muted">{elapsedLabel(order.createdAt, now)}</div>
                  {col.next && (
                    <button
                      className="rounded-[9px] bg-accent py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                      disabled={advance.isPending}
                      onClick={() => advance.mutate({ id: order._id, action: col.next! })}
                    >
                      {col.action}
                    </button>
                  )}
                  {!col.next && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-success">Waiting for waiter</div>
                  )}
                </div>
              ))}
              {columnOrders.length === 0 && <div className="text-xs text-text-muted">Empty</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
