import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings2 } from "lucide-react";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

interface Branch {
  _id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
  address?: { city?: string };
  settings?: { payment?: { allowPayLater?: boolean } };
}

interface TenantDefaults {
  payment: { allowPayLater: boolean };
}

const schema = z.object({
  name: z.string().min(1, "Required"),
  slug: z
    .string()
    .min(1, "Required")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase, alphanumeric, hyphen-separated (e.g. indiranagar)"),
});
type FormValues = z.infer<typeof schema>;

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<Branch[]>("/admin/branches") });
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [settingsBranch, setSettingsBranch] = useState<Branch | null>(null);

  const create = useMutation({
    mutationFn: (data: FormValues) => api.post("/admin/branches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      form.reset();
      setOpen(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create branch."),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.post(`/admin/branches/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "Could not deactivate branch."),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">Branches</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Branch</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((data) => create.mutate(data))} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Indiranagar" />
                {form.formState.errors.name && (
                  <div className="text-xs text-danger">{form.formState.errors.name.message}</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Slug</Label>
                <Input {...form.register("slug")} placeholder="indiranagar" />
                {form.formState.errors.slug && (
                  <div className="text-xs text-danger">{form.formState.errors.slug.message}</div>
                )}
              </div>
              {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm2">
        <div className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-2 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-text-muted">
          <div>Name</div>
          <div>City</div>
          <div>Status</div>
          <div />
          <div />
        </div>
        {branches.data?.map((branch) => (
          <div
            key={branch._id}
            className="grid grid-cols-[1fr_1fr_100px_100px_120px] items-center gap-2 border-t border-border px-5 py-3 text-sm"
          >
            <div className="font-medium">
              {branch.name} {branch.isDefault && <Badge variant="secondary">Default</Badge>}
            </div>
            <div className="text-text-muted">{branch.address?.city ?? "—"}</div>
            <Badge variant={branch.status === "ACTIVE" ? "success" : "outline"}>{branch.status}</Badge>
            <Button size="sm" variant="ghost" onClick={() => setSettingsBranch(branch)}>
              <Settings2 size={14} /> Settings
            </Button>
            <div>
              {!branch.isDefault && branch.status === "ACTIVE" && (
                <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(branch._id)}>
                  Deactivate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <BranchSettingsDialog branch={settingsBranch} onClose={() => setSettingsBranch(null)} />
    </div>
  );
}

function BranchSettingsDialog({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const tenantDefaults = useQuery({
    queryKey: ["tenant-settings-defaults"],
    queryFn: () => api.get<TenantDefaults>("/tenant/settings"),
    enabled: Boolean(branch),
  });

  const save = useMutation({
    mutationFn: (allowPayLater: boolean) =>
      api.put(`/admin/branches/${branch!._id}`, { settings: { payment: { allowPayLater } } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
  });

  if (!branch) return null;

  const tenantDefault = tenantDefaults.data?.payment.allowPayLater ?? false;
  const effective = branch.settings?.payment?.allowPayLater ?? tenantDefault;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{branch.name} — Settings</DialogTitle>
          <DialogDescription>Overrides the tenant-wide default for this branch only.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Label>Accept Payment Later (Pay at Counter)</Label>
              <span className="text-xs text-text-muted">
                Customers can send an order to the kitchen before paying; staff collect payment afterward.
              </span>
            </div>
            <Switch checked={effective} disabled={save.isPending} onCheckedChange={(v) => save.mutate(v)} />
          </div>
          {branch.settings?.payment?.allowPayLater === undefined && (
            <div className="text-xs text-text-muted">
              Currently inheriting the tenant default ({tenantDefault ? "on" : "off"}). Toggling sets an explicit
              override for this branch.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
