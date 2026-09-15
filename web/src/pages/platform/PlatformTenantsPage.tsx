import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Plus, Copy, Check } from "lucide-react";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  subscription?: { planId?: string; endDate?: string };
  createdAt: string;
}

/** Same 7-day warning window as the backend's renewal computation (§47A) — just enough to
 * flag it in the list; the full notice lives on the tenant detail page. */
function isRenewalDueSoon(tenant: Tenant): boolean {
  if (tenant.status !== "ACTIVE" || !tenant.subscription?.endDate) return false;
  const days = Math.ceil((new Date(tenant.subscription.endDate).getTime() - Date.now()) / 86_400_000);
  return days <= 7;
}

interface CreateTenantResult {
  tenant: Tenant;
  admin: { id: string; email: string; inviteLink: string };
}

const STATUS_VARIANT: Record<string, "success" | "secondary" | "outline" | "danger"> = {
  ACTIVE: "success",
  TRIAL: "secondary",
  SUSPENDED: "outline",
  CANCELLED: "danger",
};

const schema = z.object({
  name: z.string().min(1, "Required"),
  slug: z
    .string()
    .min(1, "Required")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase, alphanumeric, hyphen-separated (e.g. green-leaf)"),
  adminName: z.string().min(1, "Required"),
  adminEmail: z.string().min(1, "Required").email("Enter a valid email address"),
  planId: z.enum(["FREE", "STARTER", "PRO", "ENTERPRISE"]),
});
type FormValues = z.infer<typeof schema>;

export default function PlatformTenantsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const tenants = useQuery({ queryKey: ["platform-tenants"], queryFn: () => api.get<Tenant[]>("/platform/tenants") });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { planId: "FREE" } });
  const [created, setCreated] = useState<CreateTenantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: (data: FormValues) => api.post<CreateTenantResult>("/platform/tenants", data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      form.reset({ planId: "FREE" });
      setError(null);
      setCreated(result);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create tenant."),
  });

  async function copyInviteLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the link is still shown on screen to copy manually.
    }
  }

  function closeDialog() {
    setOpen(false);
    setCreated(null);
    setCopied(false);
  }

  const filtered = (tenants.data ?? []).filter((t) => !statusFilter || t.status === statusFilter);
  const counts = {
    ALL: tenants.data?.length ?? 0,
    ACTIVE: tenants.data?.filter((t) => t.status === "ACTIVE").length ?? 0,
    TRIAL: tenants.data?.filter((t) => t.status === "TRIAL").length ?? 0,
    SUSPENDED: tenants.data?.filter((t) => t.status === "SUSPENDED").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Tenants</h1>
        <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            {created ? (
              <>
                <DialogHeader>
                  <DialogTitle>Tenant Created</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3.5">
                  <div className="rounded-control bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
                    {created.tenant.name} is ready. No email provider is configured, so send this set-password link
                    to {created.admin.email} yourself.
                  </div>
                  <div className="flex items-center gap-1.5 rounded-control border border-border bg-bg px-2.5 py-2">
                    <Input readOnly value={created.admin.inviteLink} className="h-7 flex-1 border-0 bg-transparent px-0 text-xs" />
                    <button
                      type="button"
                      onClick={() => copyInviteLink(created.admin.inviteLink)}
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] text-text-muted hover:bg-surface hover:text-text"
                    >
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={closeDialog}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create Tenant</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label>Café Name</Label>
                    <Input {...form.register("name")} />
                    {form.formState.errors.name && (
                      <div className="text-xs text-danger">{form.formState.errors.name.message}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Slug</Label>
                    <Input {...form.register("slug")} placeholder="green-leaf" />
                    {form.formState.errors.slug && (
                      <div className="text-xs text-danger">{form.formState.errors.slug.message}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Admin Name</Label>
                    <Input {...form.register("adminName")} />
                    {form.formState.errors.adminName && (
                      <div className="text-xs text-danger">{form.formState.errors.adminName.message}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Admin Email</Label>
                    <Input type="email" {...form.register("adminEmail")} />
                    {form.formState.errors.adminEmail && (
                      <div className="text-xs text-danger">{form.formState.errors.adminEmail.message}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Plan</Label>
                    <Select defaultValue="FREE" onValueChange={(v) => form.setValue("planId", v as FormValues["planId"])}>
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
                  </div>
                  {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}
                  <DialogFooter>
                    <Button type="submit" disabled={create.isPending}>
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "", label: `All (${counts.ALL})` },
          { key: "ACTIVE", label: `Active (${counts.ACTIVE})` },
          { key: "TRIAL", label: `Trial (${counts.TRIAL})` },
          { key: "SUSPENDED", label: `Suspended (${counts.SUSPENDED})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              statusFilter === f.key ? "bg-accent text-white" : "border border-border text-text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[1fr_110px_100px_90px_100px] gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              <div>Tenant</div>
              <div>Plan</div>
              <div>Status</div>
              <div>Since</div>
              <div />
            </div>
            {filtered.map((tenant) => (
              <div key={tenant._id} className="grid grid-cols-[1fr_110px_100px_90px_100px] items-center gap-2 border-t border-border px-5 py-3.5 text-sm">
                <div className="flex items-center gap-2.5 font-semibold">
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-accent font-display text-[10px] font-extrabold text-white">
                    {tenant.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate">{tenant.name}</span>
                </div>
                <div className="text-text-muted">{tenant.subscription?.planId ?? "FREE"}</div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={STATUS_VARIANT[tenant.status]}>{tenant.status}</Badge>
                  {isRenewalDueSoon(tenant) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" title="Renewal due soon" />
                  )}
                </div>
                <div className="text-text-muted">{new Date(tenant.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
                <Link to={`/platform/tenants/${tenant._id}`} className="text-xs font-semibold text-accent">
                  View →
                </Link>
              </div>
            ))}
            {filtered.length === 0 && <div className="px-5 py-8 text-center text-sm text-text-muted">No tenants match this filter.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
