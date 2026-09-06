import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface IntegrationSettings {
  provider: "SWIGGY" | "ZOMATO";
  planEnabled: boolean;
  enabled: boolean;
  outletId: string | null;
  hasApiKey: boolean;
  updatedAt: string | null;
}

const LABEL: Record<IntegrationSettings["provider"], string> = {
  SWIGGY: "Swiggy",
  ZOMATO: "Zomato",
};

function IntegrationCard({ settings }: { settings: IntegrationSettings }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [outletId, setOutletId] = useState(settings.outletId ?? "");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(settings.enabled);
    setOutletId(settings.outletId ?? "");
    setApiKey("");
  }, [settings.enabled, settings.outletId]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { enabled, outletId };
      if (apiKey) body.apiKey = apiKey;
      return api.put(`/tenant/integrations/${settings.provider}`, body);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again."),
  });

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm2">
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-bold">{LABEL[settings.provider]}</div>
        {!settings.planEnabled && (
          <span className="rounded-full bg-secondary-soft px-2.5 py-1 text-[11px] font-semibold text-text-muted">
            Not on your plan
          </span>
        )}
      </div>

      {!settings.planEnabled && (
        <div className="rounded-control bg-secondary-soft px-3 py-2 text-xs leading-relaxed text-text-muted">
          {LABEL[settings.provider]} integration isn&rsquo;t included in this café&rsquo;s current plan. Contact
          Yummverse to upgrade.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Outlet ID</Label>
        <Input
          value={outletId}
          onChange={(e) => setOutletId(e.target.value)}
          disabled={!settings.planEnabled}
          placeholder="Your café's outlet ID on this platform"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>API Key {settings.hasApiKey && "(configured — leave blank to keep)"}</Label>
        <PasswordInput
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={!settings.planEnabled}
          placeholder={settings.hasApiKey ? "••••••••••••••••" : ""}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Enabled</Label>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!settings.planEnabled} />
      </div>

      {error && <div className="rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</div>}

      <Button
        type="button"
        disabled={!settings.planEnabled || save.isPending}
        onClick={() => save.mutate()}
        className="self-start"
      >
        Save
      </Button>
    </div>
  );
}

export default function IntegrationSettingsPage() {
  const settings = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => api.get<IntegrationSettings[]>("/tenant/integrations"),
  });

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Third-Party Integrations</h1>
        <p className="mt-1 text-sm text-text-muted">
          Connect your café&rsquo;s own Swiggy and Zomato outlets. Availability is controlled by your plan.
        </p>
      </div>

      {settings.data?.map((s) => <IntegrationCard key={s.provider} settings={s} />)}
    </div>
  );
}
