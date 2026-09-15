import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Branch {
  _id: string;
  name: string;
  isDefault: boolean;
}

interface PaymentSettings {
  provider: string;
  currency: string;
  enabled: boolean;
  testMode: boolean;
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  isOverride: boolean;
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
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState<string>("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<Branch[]>("/admin/branches") });
  const isMultiBranch = (branches.data?.length ?? 0) > 1;

  const settings = useQuery({
    queryKey: ["payment-settings", branchId],
    queryFn: () => api.get<PaymentSettings | null>(`/tenant/payment-settings${branchId ? `?branchId=${branchId}` : ""}`),
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
      return api.put(`/tenant/payment-settings${branchId ? `?branchId=${branchId}` : ""}`, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-settings"] }),
  });

  const clearOverride = useMutation({
    mutationFn: () => api.delete(`/tenant/payment-settings?branchId=${branchId}`),
    onSuccess: () => {
      setBranchId("");
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
    },
  });

  const testConnection = useMutation({
    mutationFn: () => api.post<{ ok: boolean; message: string }>(`/tenant/payment-settings/test${branchId ? `?branchId=${branchId}` : ""}`),
    onSuccess: (result) => setTestResult(result),
    onError: (err) => setTestResult({ ok: false, message: err instanceof ApiError ? err.message : "Test failed." }),
  });

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Payment Settings</h1>

      {isMultiBranch && (
        <div className="flex flex-wrap items-center gap-3">
          <Label>Configuring for</Label>
          <Select value={branchId || "TENANT"} onValueChange={(v) => setBranchId(v === "TENANT" ? "" : v)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TENANT">Tenant-wide default</SelectItem>
              {branches.data?.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {branchId && settings.data?.isOverride && (
            <Button size="sm" variant="ghost" onClick={() => clearOverride.mutate()}>
              Use tenant-wide default instead
            </Button>
          )}
        </div>
      )}

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
