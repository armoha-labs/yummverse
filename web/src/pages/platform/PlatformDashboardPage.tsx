import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

interface Summary {
  tenants: { total: number; active: number; trial: number; suspended: number; cancelled: number };
  last30Days: { platformWideRevenue: number; orderCount: number };
  renewalsDueSoon: number;
}

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function PlatformDashboardPage() {
  const { data } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: () => api.get<Summary>("/platform/reports/summary"),
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Platform Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total Tenants" value={data?.tenants.total ?? "—"} />
        <Stat label="Active" value={data?.tenants.active ?? "—"} />
        <Stat label="Trial" value={data?.tenants.trial ?? "—"} />
        <Stat label="Suspended" value={data?.tenants.suspended ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Platform-Wide Revenue (30 days)" value={data ? currency(data.last30Days.platformWideRevenue) : "—"} big />
        <Stat label="Orders (30 days)" value={data?.last30Days.orderCount ?? "—"} big />
        <Stat
          label="Renewals Due (7 days)"
          value={data?.renewalsDueSoon ?? "—"}
          big
          tone={data && data.renewalsDueSoon > 0 ? "warning" : undefined}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, big, tone }: { label: string; value: string | number; big?: boolean; tone?: "warning" }) {
  return (
    <div className={`rounded-card border p-[18px] shadow-sm2 ${tone === "warning" ? "border-danger/30 bg-danger-soft" : "border-border bg-surface"}`}>
      <div className={`text-[12.5px] font-semibold ${tone === "warning" ? "text-danger" : "text-text-muted"}`}>{label}</div>
      <div className={`mt-2 font-display font-extrabold ${big ? "text-3xl" : "text-2xl"} ${tone === "warning" ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}
