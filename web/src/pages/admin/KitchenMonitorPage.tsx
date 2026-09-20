import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { useTenantSettings } from "@/lib/useTenantSettings";

interface OrderItem {
  name: string;
  quantity: number;
  note?: string;
}

interface OrderRow {
  _id: string;
  orderNumber: number;
  channel: "QR" | "POS";
  items: OrderItem[];
  orderStatus: "NEW" | "ACCEPTED" | "PREPARING" | "READY";
}

const COLUMNS: { status: OrderRow["orderStatus"]; label: string; action?: string; next?: string }[] = [
  { status: "NEW", label: "New", action: "Accept", next: "accept" },
  { status: "ACCEPTED", label: "Accepted", action: "Start Preparing", next: "preparing" },
  { status: "PREPARING", label: "Preparing", action: "Mark Ready", next: "ready" },
  { status: "READY", label: "Ready", action: "Mark Served", next: "served" },
];

export default function KitchenMonitorPage() {
  const queryClient = useQueryClient();
  const settings = useTenantSettings();
  const kitchenEnabled = settings.data?.ordering.kitchenEnabled ?? true;

  const orders = useQuery({
    queryKey: ["admin-kitchen-orders"],
    queryFn: () => api.get<OrderRow[]>("/admin/kitchen/orders"),
    refetchInterval: 5000,
    enabled: kitchenEnabled,
  });

  const advance = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/admin/kitchen/orders/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-kitchen-orders"] }),
  });

  if (settings.data && !kitchenEnabled) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold">Kitchen Monitor</h1>
        <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted shadow-sm2">
          Kitchen workflow is turned off for this café. Orders are marked Served directly from
          the Orders screen. Turn it back on under Settings → Operations.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Kitchen Monitor</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const columnOrders = (orders.data ?? []).filter((o) => o.orderStatus === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-sm2">
              <div className="flex items-center justify-between px-1">
                <div className="font-display text-sm font-bold">{col.label}</div>
                <div className="text-xs text-text-muted">{columnOrders.length}</div>
              </div>
              <div className="flex flex-col gap-2">
                {columnOrders.map((order) => (
                  <div key={order._id} className="rounded-control border border-border bg-bg p-3">
                    <div className="mb-1.5 font-semibold text-sm">#{order.orderNumber}</div>
                    <div className="mb-2 flex flex-col gap-0.5 text-xs text-text-muted">
                      {order.items.map((item, i) => (
                        <div key={i}>
                          {item.name} ×{item.quantity}
                          {item.note ? ` — ${item.note}` : ""}
                        </div>
                      ))}
                    </div>
                    {col.next && (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={advance.isPending}
                        onClick={() => advance.mutate({ id: order._id, action: col.next! })}
                      >
                        {col.action}
                      </Button>
                    )}
                  </div>
                ))}
                {columnOrders.length === 0 && <div className="px-1 text-xs text-text-muted">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
