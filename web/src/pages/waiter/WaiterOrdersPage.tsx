import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OrderItem {
  name: string;
  quantity: number;
}

interface OrderRow {
  _id: string;
  orderNumber: number;
  tableId?: { tableNumber: string } | null; // populated with just the number
  items: OrderItem[];
  orderStatus: "NEW" | "ACCEPTED" | "PREPARING" | "READY";
}

function tableLabel(order: OrderRow): string {
  return order.tableId ? ` · Table ${order.tableId.tableNumber}` : " · Takeaway";
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
};

export default function WaiterOrdersPage() {
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["waiter-orders"],
    queryFn: () => api.get<OrderRow[]>("/waiter/orders"),
    refetchInterval: 6000,
  });

  const markServed = useMutation({
    mutationFn: (id: string) => api.post(`/waiter/orders/${id}/served`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
      queryClient.invalidateQueries({ queryKey: ["waiter-tables"] });
    },
  });

  const ready = orders.data?.filter((o) => o.orderStatus === "READY") ?? [];
  const inProgress = orders.data?.filter((o) => o.orderStatus !== "READY") ?? [];

  return (
    <div className="flex flex-col gap-3">
      {ready.length > 0 && (
        <>
          <SectionLabel label="Ready to serve" tone="success" />
          {ready.map((order) => (
            <div key={order._id} className="flex flex-col gap-2.5 rounded-card border-2 border-success bg-surface p-4 shadow-sm2">
              <div className="flex items-center justify-between">
                <div className="font-display text-[15px] font-extrabold">
                  #{order.orderNumber}
                  {tableLabel(order)}
                </div>
                <Badge variant="success">Ready</Badge>
              </div>
              <div className="text-xs text-text-muted">{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
              <Button size="sm" disabled={markServed.isPending} onClick={() => markServed.mutate(order._id)}>
                Mark Served
              </Button>
            </div>
          ))}
        </>
      )}

      {inProgress.length > 0 && (
        <>
          <SectionLabel label="In progress" tone="muted" />
          {inProgress.map((order) => (
            <div key={order._id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-sm2">
              <div className="flex items-center justify-between">
                <div className="font-display text-[15px] font-extrabold">
                  #{order.orderNumber}
                  {tableLabel(order)}
                </div>
                <Badge variant="secondary">{STATUS_LABEL[order.orderStatus]}</Badge>
              </div>
              <div className="text-xs text-text-muted">{order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}</div>
            </div>
          ))}
        </>
      )}

      {orders.data?.length === 0 && <div className="py-10 text-center text-sm text-text-muted">No active orders right now.</div>}
    </div>
  );
}

function SectionLabel({ label, tone }: { label: string; tone: "success" | "muted" }) {
  return (
    <div className={`text-[11.5px] font-bold uppercase tracking-wide ${tone === "success" ? "text-success" : "text-text-muted"}`}>
      {label}
    </div>
  );
}
