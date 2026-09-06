import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Profile {
  name: string;
  contact?: { phone?: string; email?: string };
}

interface Settings {
  tax: { enabled: boolean; percentage: number };
  serviceCharge: { enabled: boolean; percentage: number };
  ordering: { collectCustomerPhone: boolean; allowMultipleOrdersPerTable: boolean };
  payment: { allowPayLater: boolean };
}

interface Branding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export default function SettingsPage() {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold">Settings</h1>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-5">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="operations" className="mt-5">
          <OperationsTab />
        </TabsContent>
        <TabsContent value="branding" className="mt-5">
          <BrandingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["tenant-profile"], queryFn: () => api.get<Profile>("/tenant/profile") });
  const { register, handleSubmit, reset } = useForm<{ name: string; phone: string; email: string }>();

  useEffect(() => {
    if (profile.data) {
      reset({ name: profile.data.name, phone: profile.data.contact?.phone ?? "", email: profile.data.contact?.email ?? "" });
    }
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (data: { name: string; phone: string; email: string }) =>
      api.put("/tenant/profile", { name: data.name, contact: { phone: data.phone, email: data.email } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-profile"] }),
  });

  return (
    <form onSubmit={handleSubmit((d) => save.mutate(d))} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm2">
      <div className="flex flex-col gap-1.5">
        <Label>Café Name</Label>
        <Input {...register("name")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Contact Phone</Label>
        <Input {...register("phone")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Contact Email</Label>
        <Input type="email" {...register("email")} />
      </div>
      <Button type="submit" disabled={save.isPending} className="self-start">
        Save
      </Button>
    </form>
  );
}

function OperationsTab() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["tenant-settings"], queryFn: () => api.get<Settings>("/tenant/settings") });

  const save = useMutation({
    mutationFn: (data: Partial<Settings>) => api.put("/tenant/settings", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-settings"] }),
  });

  if (!settings.data) return null;
  const s = settings.data;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm2">
      <ToggleRow
        label="Tax"
        checked={s.tax.enabled}
        onCheckedChange={(enabled) => save.mutate({ tax: { ...s.tax, enabled } })}
      />
      {s.tax.enabled && (
        <PercentageInput
          value={s.tax.percentage}
          onSave={(percentage) => save.mutate({ tax: { ...s.tax, percentage } })}
        />
      )}
      <ToggleRow
        label="Service Charge"
        checked={s.serviceCharge.enabled}
        onCheckedChange={(enabled) => save.mutate({ serviceCharge: { ...s.serviceCharge, enabled } })}
      />
      {s.serviceCharge.enabled && (
        <PercentageInput
          value={s.serviceCharge.percentage}
          onSave={(percentage) => save.mutate({ serviceCharge: { ...s.serviceCharge, percentage } })}
        />
      )}
      <ToggleRow
        label="Collect Customer Phone at Checkout"
        checked={s.ordering.collectCustomerPhone}
        onCheckedChange={(collectCustomerPhone) => save.mutate({ ordering: { ...s.ordering, collectCustomerPhone } })}
      />
      <ToggleRow
        label="Allow Multiple Orders per Table"
        checked={s.ordering.allowMultipleOrdersPerTable}
        onCheckedChange={(allowMultipleOrdersPerTable) =>
          save.mutate({ ordering: { ...s.ordering, allowMultipleOrdersPerTable } })
        }
      />
      <ToggleRow
        label="Accept Payment Later (Pay at Counter)"
        checked={s.payment.allowPayLater}
        onCheckedChange={(allowPayLater) => save.mutate({ payment: { ...s.payment, allowPayLater } })}
      />
      <div className="-mt-2 pl-0 text-xs text-text-muted">
        Default for new branches. Each branch can override this under Branches.
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function PercentageInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  return (
    <div className="flex items-center gap-2 pl-4">
      <Input
        type="number"
        step="0.1"
        className="w-24"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onSave(Number(local))}
      />
      <span className="text-sm text-text-muted">%</span>
    </div>
  );
}

function BrandingTab() {
  const queryClient = useQueryClient();
  const branding = useQuery({ queryKey: ["tenant-branding-edit"], queryFn: () => api.get<Branding>("/tenant/branding") });
  const fileRef = useRef<HTMLInputElement>(null);

  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  useEffect(() => {
    if (branding.data) {
      setPrimaryColor(branding.data.primaryColor ?? "");
      setSecondaryColor(branding.data.secondaryColor ?? "");
    }
  }, [branding.data]);

  const saveColors = useMutation({
    mutationFn: () => api.put("/tenant/branding", { primaryColor, secondaryColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-branding-edit"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.postForm("/tenant/branding/logo", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-branding-edit"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-profile"] });
    },
  });

  return (
    <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 shadow-sm2">
      <div className="flex flex-col gap-2">
        <Label>Café Logo</Label>
        <div className="flex items-center gap-4">
          {branding.data?.logoUrl ? (
            <img src={branding.data.logoUrl} alt="" className="h-16 w-16 rounded-2xl border border-border object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-2xl border border-dashed border-border" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo.mutate(file);
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Upload New Logo
          </Button>
        </div>
        <div className="text-xs text-text-muted">Recommended: square PNG/SVG, max 2MB</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Primary Color</Label>
          <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#4B2E2B" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Secondary Color</Label>
          <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#E8C39E" />
        </div>
      </div>

      <Button type="button" disabled={saveColors.isPending} className="self-start" onClick={() => saveColors.mutate()}>
        Save Branding
      </Button>
    </div>
  );
}
