import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, apiFetch, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaymentSettings {
  provider: string;
  currency: string;
  enabled: boolean;
  testMode: boolean;
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
}

interface FormValues {
  provider: string;
  currency: string;
  enabled: boolean;
  testMode: boolean;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export default function PaymentSettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Payments</h1>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-5">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="report" className="mt-5">
          <PaymentsReportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const settings = useQuery({
    queryKey: ["payment-settings"],
    queryFn: () => api.get<PaymentSettings | null>("/tenant/payment-settings"),
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: { provider: "RAZORPAY", currency: "INR", enabled: false, testMode: true, keyId: "", keySecret: "", webhookSecret: "" },
  });

  useEffect(() => {
    if (settings.data) {
      reset({
        provider: settings.data.provider,
        currency: settings.data.currency,
        enabled: settings.data.enabled,
        testMode: settings.data.testMode,
        keyId: settings.data.keyId ?? "",
        keySecret: "",
        webhookSecret: "",
      });
    }
  }, [settings.data, reset]);

  const save = useMutation({
    mutationFn: (data: FormValues) => {
      const body: Record<string, unknown> = {
        provider: data.provider,
        currency: data.currency,
        enabled: data.enabled,
        testMode: data.testMode,
        keyId: data.keyId,
      };
      if (data.keySecret) body.keySecret = data.keySecret;
      if (data.webhookSecret) body.webhookSecret = data.webhookSecret;
      return api.put("/tenant/payment-settings", body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-settings"] }),
  });

  const testConnection = useMutation({
    mutationFn: () => {
      const data = watch();
      // Test whatever's currently in the form (not yet saved) — falls back on the backend to
      // the already-saved Key Secret when this is blank, same "leave blank to keep"
      // convention Save uses, so re-testing after just changing the currency still works.
      return api.post<{ ok: boolean; message: string }>("/tenant/payment-settings/test", {
        provider: data.provider,
        keyId: data.keyId || undefined,
        keySecret: data.keySecret || undefined,
      });
    },
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ ok: false, message: err instanceof ApiError ? err.message : "Test failed." }),
  });

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <form onSubmit={handleSubmit((data) => save.mutate(data))} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm2">
        <div className="flex flex-col gap-1.5">
          <Label>Provider</Label>
          <Select value={watch("provider")} onValueChange={(v) => setValue("provider", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RAZORPAY">Razorpay</SelectItem>
              <SelectItem value="STRIPE">Stripe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Key ID</Label>
          <Input {...register("keyId")} placeholder="rzp_live_xxxxxxxxx" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Key Secret {settings.data?.hasKeySecret && "(configured — leave blank to keep)"}</Label>
          <PasswordInput {...register("keySecret")} placeholder={settings.data?.hasKeySecret ? "••••••••••••••••" : ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Webhook Secret {settings.data?.hasWebhookSecret && "(configured — leave blank to keep)"}</Label>
          <PasswordInput {...register("webhookSecret")} placeholder={settings.data?.hasWebhookSecret ? "••••••••••••••••" : ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Currency</Label>
          <Select value={watch("currency")} onValueChange={(v) => setValue("currency", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>Payment Gateway Enabled</Label>
          <Switch checked={watch("enabled")} onCheckedChange={(v) => setValue("enabled", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Test Mode</Label>
          <Switch checked={watch("testMode")} onCheckedChange={(v) => setValue("testMode", v)} />
        </div>

        {testResult && (
          <div className={`rounded-control px-3 py-2 text-xs font-medium ${testResult.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={testConnection.isPending} onClick={() => testConnection.mutate()}>
            Test Connection
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
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

const STATUS_VARIANT: Record<PaymentTransaction["status"], "success" | "danger" | "secondary" | "outline"> = {
  PAID: "success",
  REFUNDED: "outline",
  REFUND_PENDING: "secondary",
  FAILED: "danger",
  CREATED: "secondary",
  PENDING: "secondary",
};

function PaymentsReportTab() {
  const { data } = useQuery({ queryKey: ["report-payments"], queryFn: () => api.get<PaymentsReport>("/tenant/reports/payments") });
  const [refunding, setRefunding] = useState<PaymentTransaction | null>(null);

  async function exportReport(format: "csv" | "excel" | "pdf") {
    const blob = await apiFetch<Blob>("/tenant/reports/export", {
      method: "POST",
      body: JSON.stringify({ reportType: "payments", format }),
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments.${format === "excel" ? "xlsx" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat label="Total Refunded" value={currency(data.refundTotal)} />
          <Stat label="Refunds Issued" value={data.refundCount} />
        </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-border bg-surface p-[18px] shadow-sm2">
      <div className="text-[12.5px] font-semibold text-text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}
