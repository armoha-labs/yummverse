import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RevenueReport {
  grossRevenue: number;
  netRevenue: number;
  averageOrderValue: number;
  orderCount: number;
  grossRevenueChangePct: number | null;
  revenueByPaymentMethod: { method: string; amount: number }[];
  revenueByBranch: { branchId: string; branchName: string; amount: number }[];
}

interface TaxReport {
  totalTaxCollected: number;
  totalCgstCollected: number;
  totalSgstCollected: number;
  taxableOrderAmount: number;
  byRate: {
    ratePercentage: number;
    taxableAmount: number;
    taxCollected: number;
    cgstCollected: number;
    sgstCollected: number;
    orderCount: number;
  }[];
}

interface ItemPerformanceReport {
  topByQuantity: { name: string; quantitySold: number; revenue: number; percentOfRevenue: number }[];
  slowMoving: { name: string; quantitySold: number }[];
}

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const REPORT_TYPES = [
  { value: "revenue", label: "Revenue" },
  { value: "tax", label: "GST" },
  { value: "item-performance", label: "Item Performance" },
] as const;

export default function ReportsPage() {
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]["value"]>("revenue");

  async function exportReport(format: "csv" | "excel" | "pdf") {
    const blob = await apiFetch<Blob>("/tenant/reports/export", {
      method: "POST",
      body: JSON.stringify({ reportType, format }),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}.${format === "excel" ? "xlsx" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Reports</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => exportReport("csv")}>
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportReport("excel")}>
            Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportReport("pdf")}>
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
        <TabsList>
          {REPORT_TYPES.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="revenue" className="mt-5">
          <RevenueTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-5">
          <TaxTab />
        </TabsContent>
        <TabsContent value="item-performance" className="mt-5">
          <ItemPerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RevenueTab() {
  const { data } = useQuery({ queryKey: ["report-revenue"], queryFn: () => api.get<RevenueReport>("/tenant/reports/revenue") });
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gross Revenue" value={currency(data.grossRevenue)} delta={data.grossRevenueChangePct} />
        <Stat label="Net Revenue" value={currency(data.netRevenue)} />
        <Stat label="Orders" value={data.orderCount} />
        <Stat label="AOV" value={currency(data.averageOrderValue)} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="By Payment Method">
          {data.revenueByPaymentMethod.map((m) => (
            <Row key={m.method} label={m.method} value={currency(m.amount)} />
          ))}
        </Panel>
        <Panel title="By Branch">
          {data.revenueByBranch.map((b) => (
            <Row key={b.branchId} label={b.branchName} value={currency(b.amount)} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function TaxTab() {
  const { data } = useQuery({ queryKey: ["report-tax"], queryFn: () => api.get<TaxReport>("/tenant/reports/tax") });
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total GST Collected" value={currency(data.totalTaxCollected)} />
        <Stat label="CGST" value={currency(data.totalCgstCollected)} />
        <Stat label="SGST" value={currency(data.totalSgstCollected)} />
        <Stat label="Taxable Amount" value={currency(data.taxableOrderAmount)} />
      </div>
      <Panel title="By Rate">
        {data.byRate.map((r) => (
          <Row
            key={r.ratePercentage}
            label={`${r.ratePercentage}%`}
            value={`${currency(r.taxCollected)} (CGST ${currency(r.cgstCollected)} + SGST ${currency(r.sgstCollected)}) · ${r.orderCount} orders`}
          />
        ))}
      </Panel>
    </div>
  );
}

function ItemPerformanceTab() {
  const { data } = useQuery({
    queryKey: ["report-item-performance"],
    queryFn: () => api.get<ItemPerformanceReport>("/tenant/reports/item-performance"),
  });
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Top Sellers">
        {data.topByQuantity.map((item, i) => (
          <Row key={i} label={item.name} value={`×${item.quantitySold} · ${currency(item.revenue)}`} />
        ))}
      </Panel>
      <Panel title="Slow Moving">
        {data.slowMoving.map((item, i) => (
          <Row key={i} label={item.name} value={`×${item.quantitySold}`} />
        ))}
      </Panel>
    </div>
  );
}

function Stat({ label, value, delta }: { label: string; value: string | number; delta?: number | null }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[18px] shadow-sm2">
      <div className="text-[12.5px] font-semibold text-text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={`mt-1 text-xs font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
      <div className="border-b border-border px-5 py-3 font-display text-sm font-bold">{title}</div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-sm first:border-t-0">
      <div className="truncate text-text-muted">{label}</div>
      <div className="min-w-0 text-right font-semibold">{value}</div>
    </div>
  );
}
