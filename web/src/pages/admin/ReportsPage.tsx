import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiFetch, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  taxableOrderAmount: number;
  byRate: { ratePercentage: number; taxableAmount: number; taxCollected: number; orderCount: number }[];
}

interface ItemPerformanceReport {
  topByQuantity: { name: string; quantitySold: number; revenue: number; percentOfRevenue: number }[];
  slowMoving: { name: string; quantitySold: number }[];
}

interface PaymentTransaction {
  _id: string;
  orderId: string;
  amount: number;
  refundedAmount?: number;
  currency: string;
  status: "CREATED" | "PENDING" | "PAID" | "FAILED" | "REFUND_PENDING" | "REFUNDED";
  provider?: string;
  providerPaymentId?: string;
  method?: string;
  createdAt: string;
}

interface PaymentsReport {
  transactions: PaymentTransaction[];
  refundTotal: number;
  refundCount: number;
}

function currency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const REPORT_TYPES = [
  { value: "revenue", label: "Revenue" },
  { value: "tax", label: "Tax" },
  { value: "item-performance", label: "Item Performance" },
  { value: "payments", label: "Payments" },
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
        <TabsContent value="payments" className="mt-5">
          <PaymentsTab />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total Tax Collected" value={currency(data.totalTaxCollected)} />
        <Stat label="Taxable Amount" value={currency(data.taxableOrderAmount)} />
      </div>
      <Panel title="By Rate">
        {data.byRate.map((r) => (
          <Row key={r.ratePercentage} label={`${r.ratePercentage}%`} value={`${currency(r.taxCollected)} · ${r.orderCount} orders`} />
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

const STATUS_VARIANT: Record<PaymentTransaction["status"], "success" | "danger" | "secondary" | "outline"> = {
  PAID: "success",
  REFUNDED: "outline",
  REFUND_PENDING: "secondary",
  FAILED: "danger",
  CREATED: "secondary",
  PENDING: "secondary",
};

function PaymentsTab() {
  const { data } = useQuery({ queryKey: ["report-payments"], queryFn: () => api.get<PaymentsReport>("/tenant/reports/payments") });
  const [refunding, setRefunding] = useState<PaymentTransaction | null>(null);
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total Refunded" value={currency(data.refundTotal)} />
        <Stat label="Refunds Issued" value={data.refundCount} />
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 border-b border-border px-5 py-3 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
              <div>Transaction ID</div>
              <div>Amount</div>
              <div>Refunded</div>
              <div>Status</div>
              <div />
            </div>
            {data.transactions.map((t) => {
              const refunded = t.refundedAmount ?? 0;
              const remaining = Math.round((t.amount - refunded) * 100) / 100;
              const canRefund = t.status === "PAID" && remaining > 0;
              return (
                <div key={t._id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-3 border-t border-border px-5 py-3 text-sm">
                  <div className="truncate font-mono text-xs text-text-muted" title={t._id}>
                    {t._id}
                  </div>
                  <div className="font-semibold">{currency(t.amount)}</div>
                  <div className="text-text-muted">{refunded > 0 ? currency(refunded) : "—"}</div>
                  <div>
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status.replace("_", " ")}</Badge>
                  </div>
                  <div>
                    {canRefund && (
                      <Button size="sm" variant="outline" onClick={() => setRefunding(t)}>
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {data.transactions.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-text-muted">No transactions in this period.</div>
            )}
          </div>
        </div>
      </div>

      <RefundDialog transaction={refunding} onClose={() => setRefunding(null)} />
    </div>
  );
}

function RefundDialog({ transaction, onClose }: { transaction: PaymentTransaction | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const remaining = transaction ? Math.round((transaction.amount - (transaction.refundedAmount ?? 0)) * 100) / 100 : 0;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refund = useMutation({
    mutationFn: (payload: { amount?: number }) => api.post(`/payments/${transaction!._id}/refund`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-payments"] });
      handleClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't process the refund."),
  });

  function handleClose() {
    setAmount("");
    setError(null);
    onClose();
  }

  function submit() {
    setError(null);
    if (amount.trim() === "") {
      refund.mutate({}); // full remaining balance
      return;
    }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    if (parsed > remaining) {
      setError(`Cannot exceed the outstanding balance of ${currency(remaining)}.`);
      return;
    }
    refund.mutate({ amount: parsed });
  }

  return (
    <Dialog open={Boolean(transaction)} onOpenChange={(open) => !open && handleClose()}>
      {transaction && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund Transaction</DialogTitle>
            <DialogDescription className="font-mono">{transaction._id}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Outstanding balance</span>
              <span className="font-semibold">{currency(remaining)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11.5px] font-semibold text-text-muted">Refund amount</label>
              <Input
                type="number"
                min={0}
                max={remaining}
                step="0.01"
                placeholder={`Full amount (${currency(remaining)})`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="text-xs text-text-muted">Leave blank to refund the full outstanding balance.</div>
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={refund.isPending} onClick={submit}>
              {refund.isPending ? "Refunding…" : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
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
    <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-sm first:border-t-0">
      <div className="truncate text-text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
