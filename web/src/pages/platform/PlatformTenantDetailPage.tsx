import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Copy, Check, Send, FileText, CircleDollarSign } from "lucide-react";
import { api, apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  subscription?: { planId?: string; status?: string; startDate?: string; endDate?: string; trialEndsAt?: string };
  createdAt: string;
  admin: { id: string; email: string; hasPassword: boolean } | null;
}

interface ResendInviteResult {
  email: string;
  inviteLink: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  planId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "SENT" | "PAID";
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Mirrors backend/src/config/plans.ts PLAN_PRICING — display only.
const PLAN_PRICE: Record<string, number> = { FREE: 0, STARTER: 999, PRO: 2999, ENTERPRISE: 9999 };

const INVOICE_STATUS_VARIANT: Record<Invoice["status"], "success" | "secondary" | "outline"> = {
  DRAFT: "outline",
  SENT: "secondary",
  PAID: "success",
};

function money(amount: number, currency = "INR"): string {
  return `${currency} ${amount.toLocaleString("en-IN")}`;
}

function shortDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

/** Client-side mirror of the backend's renewal computation — same 7-day warning window,
 * only meaningful once a tenant is actually ACTIVE with a renewal date set. */
function renewalNotice(tenant: Tenant): { level: "overdue" | "due_soon"; days: number } | null {
  if (tenant.status !== "ACTIVE" || !tenant.subscription?.endDate) return null;
  const days = Math.ceil((new Date(tenant.subscription.endDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { level: "overdue", days };
  if (days <= 7) return { level: "due_soon", days };
  return null;
}

interface PlanLimits {
  maxBranches: number;
  maxTables: number;
  maxStaffUsers: number;
  maxOrdersPerMonth: number;
  advancedReports: boolean;
  customBranding: boolean;
  paymentGatewayEnabled: boolean;
  thermalPrintingEnabled: boolean;
  eInvoiceWhatsappEnabled: boolean;
  firebasePushEnabled: boolean;
  swiggyIntegrationEnabled: boolean;
  zomatoIntegrationEnabled: boolean;
}

interface LimitsResponse {
  planId: string;
  planDefaults: PlanLimits;
  overrides: Partial<PlanLimits>;
  effective: PlanLimits;
}

const FIELDS: { key: keyof PlanLimits; label: string; type: "number" | "boolean" }[] = [
  { key: "maxBranches", label: "Max Branches", type: "number" },
  { key: "maxTables", label: "Max Tables", type: "number" },
  { key: "maxStaffUsers", label: "Max Staff Users", type: "number" },
  { key: "maxOrdersPerMonth", label: "Max Orders / Month", type: "number" },
  { key: "advancedReports", label: "Advanced Reports", type: "boolean" },
  { key: "customBranding", label: "Custom Branding", type: "boolean" },
  { key: "paymentGatewayEnabled", label: "Payment Gateway", type: "boolean" },
  { key: "thermalPrintingEnabled", label: "Thermal Printing Receipts", type: "boolean" },
  { key: "eInvoiceWhatsappEnabled", label: "E-Invoice to WhatsApp", type: "boolean" },
  { key: "firebasePushEnabled", label: "Firebase Push Notifications", type: "boolean" },
  { key: "swiggyIntegrationEnabled", label: "Swiggy Integration", type: "boolean" },
  { key: "zomatoIntegrationEnabled", label: "Zomato Integration", type: "boolean" },
];

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline" | "danger"> = {
  ACTIVE: "success",
  TRIAL: "secondary",
  SUSPENDED: "outline",
  CANCELLED: "danger",
};

export default function PlatformTenantDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string>>({});

  const tenant = useQuery({ queryKey: ["platform-tenant", id], queryFn: () => api.get<Tenant>(`/platform/tenants/${id}`) });
  const limits = useQuery({ queryKey: ["platform-tenant-limits", id], queryFn: () => api.get<LimitsResponse>(`/platform/tenants/${id}/limits`) });
  const invoices = useQuery({ queryKey: ["platform-tenant-invoices", id], queryFn: () => api.get<Invoice[]>(`/platform/tenants/${id}/invoices`) });

  const setStatus = useMutation({
    mutationFn: (action: "activate" | "suspend" | "cancel") => api.post(`/platform/tenants/${id}/${action}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenant", id] }),
  });

  const setPlan = useMutation({
    mutationFn: (planId: string) => api.put(`/platform/tenants/${id}/subscription`, { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant", id] });
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-limits", id] });
    },
  });

  const [renewalDraft, setRenewalDraft] = useState("");
  useEffect(() => {
    setRenewalDraft(tenant.data?.subscription?.endDate ? tenant.data.subscription.endDate.slice(0, 10) : "");
  }, [tenant.data?.subscription?.endDate]);

  const saveRenewal = useMutation({
    mutationFn: () => api.put(`/platform/tenants/${id}/subscription`, { endDate: renewalDraft || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenant", id] }),
  });

  const generateInvoice = useMutation({
    mutationFn: () => api.post<Invoice>(`/platform/tenants/${id}/invoices`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenant-invoices", id] }),
  });

  const sendInvoice = useMutation({
    mutationFn: (invoiceId: string) => api.post<Invoice>(`/platform/tenants/${id}/invoices/${invoiceId}/send`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenant-invoices", id] }),
  });

  const markInvoicePaid = useMutation({
    mutationFn: (invoiceId: string) => api.post<Invoice>(`/platform/tenants/${id}/invoices/${invoiceId}/mark-paid`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenant-invoices", id] }),
  });

  const resendInvite = useMutation({
    mutationFn: () => api.post<ResendInviteResult>(`/platform/tenants/${id}/resend-invite`),
  });
  const [copied, setCopied] = useState(false);

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the link is still shown on screen to copy manually.
    }
  }

  const saveOverrides = useMutation({
    mutationFn: () => {
      const overrides: Record<string, number | boolean> = {};
      for (const field of FIELDS) {
        const raw = draftOverrides[field.key];
        if (raw === undefined || raw === "") continue;
        overrides[field.key] = field.type === "number" ? Number(raw) : raw === "true";
      }
      return api.put(`/platform/tenants/${id}/limits`, { overrides });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenant-limits", id] });
      setDraftOverrides({});
    },
  });

  async function downloadInvoicePdf(invoiceId: string) {
    const blob = await apiFetch<Blob>(`/platform/tenants/${id}/invoices/${invoiceId}/pdf`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  if (!tenant.data || !limits.data) return null;

  const notice = renewalNotice(tenant.data);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link to="/platform/tenants" className="hover:text-text">
          Tenants
        </Link>
        <span>→</span>
        <span className="font-semibold text-text">{tenant.data.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent font-display text-base font-extrabold text-white">
            {tenant.data.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-lg font-extrabold">{tenant.data.name}</div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {tenant.data.slug} · {limits.data.planId} plan ·{" "}
              <Badge variant={STATUS_VARIANT[tenant.data.status]}>{tenant.data.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {tenant.data.status !== "ACTIVE" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("activate")}>
              Activate
            </Button>
          )}
          {tenant.data.status === "ACTIVE" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("suspend")}>
              Suspend
            </Button>
          )}
          {tenant.data.status !== "CANCELLED" && (
            <Button size="sm" variant="destructive" onClick={() => setStatus.mutate("cancel")}>
              Cancel Tenant
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-control px-4 py-2.5 text-xs font-semibold ${
            notice.level === "overdue" ? "bg-danger-soft text-danger" : "bg-secondary-soft text-text"
          }`}
        >
          {notice.level === "overdue"
            ? `Subscription renewal is ${Math.abs(notice.days)} day${Math.abs(notice.days) === 1 ? "" : "s"} overdue.`
            : `Subscription renews in ${notice.days} day${notice.days === 1 ? "" : "s"}.`}
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex w-80 flex-none flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-[18px] shadow-sm2">
            <div className="font-display text-sm font-bold">Membership</div>
            <Select value={limits.data.planId} onValueChange={(v) => setPlan.mutate(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="STARTER">Starter</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-text-muted">{money(PLAN_PRICE[limits.data.planId] ?? 0)}/month</div>

            <div className="mt-1 flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Renews On</div>
              <div className="flex gap-1.5">
                <Input type="date" value={renewalDraft} onChange={(e) => setRenewalDraft(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" disabled={saveRenewal.isPending} onClick={() => saveRenewal.mutate()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-[18px] shadow-sm2">
            <div className="font-display text-sm font-bold">Admin Access</div>
            {tenant.data.admin ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-text-muted">{tenant.data.admin.email}</span>
                  <Badge variant={tenant.data.admin.hasPassword ? "success" : "outline"}>
                    {tenant.data.admin.hasPassword ? "Active" : "Invite Pending"}
                  </Badge>
                </div>
                <div className="text-xs leading-relaxed text-text-muted">
                  An invite email is sent automatically when SMTP is configured. If it isn&rsquo;t, generate a link
                  here and send it to them yourself.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resendInvite.isPending}
                  onClick={() => resendInvite.mutate()}
                >
                  {resendInvite.isPending
                    ? "Generating…"
                    : tenant.data.admin.hasPassword
                      ? "Generate Password-Reset Link"
                      : "Generate Invite Link"}
                </Button>
                {resendInvite.data && (
                  <div className="flex items-center gap-1.5 rounded-control border border-border bg-bg px-2.5 py-2">
                    <Input readOnly value={resendInvite.data.inviteLink} className="h-7 flex-1 border-0 bg-transparent px-0 text-xs" />
                    <button
                      type="button"
                      onClick={() => copyInviteLink(resendInvite.data!.inviteLink)}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-text-muted hover:bg-surface hover:text-text"
                    >
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-text-muted">This tenant has no admin user.</div>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-[18px] shadow-sm2">
            <div className="font-display text-sm font-bold">Payment Credentials</div>
            <div className="text-xs leading-relaxed text-text-muted">
              Encrypted and not viewable here — Platform Admin does not have standing access to tenant payment
              secrets (§15).
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 rounded-card border border-border bg-surface p-[22px] shadow-sm2">
          <div>
            <div className="font-display text-sm font-bold">Limits &amp; Features</div>
            <div className="mt-1 text-xs text-text-muted">
              Plan: {limits.data.planId} — override any field below to grant an exception or restrict this tenant.
            </div>
          </div>

          <div className="grid grid-cols-[1fr_130px_160px] items-center gap-x-4 gap-y-2.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
            <div />
            <div>Plan Default</div>
            <div>Override</div>
          </div>

          {FIELDS.map((field) => {
            const planValue = limits.data!.planDefaults[field.key];
            const overrideValue = limits.data!.overrides[field.key];
            const draft = draftOverrides[field.key];
            return (
              <div key={field.key} className="grid grid-cols-[1fr_130px_160px] items-center gap-x-4 gap-y-2.5 border-t border-border pt-2.5 text-sm">
                <div className="font-semibold">{field.label}</div>
                <div className="text-text-muted">
                  {field.type === "boolean"
                    ? planValue
                      ? "Yes"
                      : "No"
                    : (planValue as number) >= 1_000_000
                      ? "∞"
                      : (planValue as number)}
                </div>
                {field.type === "boolean" ? (
                  <Select
                    value={draft ?? (overrideValue === undefined ? "unset" : String(overrideValue))}
                    onValueChange={(v) => setDraftOverrides((d) => ({ ...d, [field.key]: v === "unset" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not set</SelectItem>
                      <SelectItem value="true">Enabled</SelectItem>
                      <SelectItem value="false">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    placeholder="Not set"
                    value={draft ?? (overrideValue === undefined ? "" : String(overrideValue))}
                    onChange={(e) => setDraftOverrides((d) => ({ ...d, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}

          <Button className="mt-auto self-start" disabled={saveOverrides.isPending} onClick={() => saveOverrides.mutate()}>
            Save Overrides
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-card border border-border bg-surface p-[22px] shadow-sm2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-sm font-bold">Billing &amp; Invoices</div>
            <div className="mt-1 text-xs text-text-muted">
              Subscription billing statements for this café&rsquo;s plan — separate from any payments this café
              collects from its own customers.
            </div>
          </div>
          <Button size="sm" disabled={generateInvoice.isPending} onClick={() => generateInvoice.mutate()}>
            <FileText size={14} /> Generate Invoice
          </Button>
        </div>

        <div className="grid grid-cols-[140px_1fr_120px_100px_120px_200px] items-center gap-2 border-t border-border pt-2.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
          <div>Invoice #</div>
          <div>Period</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Paid</div>
          <div />
        </div>

        {invoices.data?.length === 0 && (
          <div className="py-6 text-center text-sm text-text-muted">No invoices yet — generate one to bill this café for its plan.</div>
        )}

        {invoices.data?.map((invoice) => (
          <div key={invoice.id} className="grid grid-cols-[140px_1fr_120px_100px_120px_200px] items-center gap-2 border-t border-border pt-2.5 text-sm">
            <div className="font-semibold">{invoice.invoiceNumber}</div>
            <div className="text-text-muted">
              {shortDate(invoice.periodStart)} – {shortDate(invoice.periodEnd)}
            </div>
            <div className="font-semibold">{money(invoice.amount, invoice.currency)}</div>
            <div>
              <Badge variant={INVOICE_STATUS_VARIANT[invoice.status]}>{invoice.status}</Badge>
            </div>
            <div className="text-text-muted">{shortDate(invoice.paidAt)}</div>
            <div className="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => downloadInvoicePdf(invoice.id)} title="View PDF">
                <FileText size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={sendInvoice.isPending}
                onClick={() => sendInvoice.mutate(invoice.id)}
                title="Email invoice to café admin"
              >
                <Send size={14} />
              </Button>
              {invoice.status !== "PAID" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={markInvoicePaid.isPending}
                  onClick={() => markInvoicePaid.mutate(invoice.id)}
                  title="Mark as paid"
                >
                  <CircleDollarSign size={14} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
