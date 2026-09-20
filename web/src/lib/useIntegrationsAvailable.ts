import { useQuery } from "@tanstack/react-query";
import { api } from "./apiClient";

interface IntegrationSettings {
  provider: "SWIGGY" | "ZOMATO";
  planEnabled: boolean;
}

/** Shares the ["integration-settings"] query with IntegrationSettingsPage — calling this
 * from AdminLayout too never triggers an extra network request. Each provider's plan
 * availability (swiggyIntegrationEnabled/zomatoIntegrationEnabled) is set by the platform
 * admin per tenant, not a tenant-admin-editable setting — see plans.ts / tenantLimitsService. */
export function useIntegrationsAvailable(): boolean {
  const query = useQuery({
    queryKey: ["integration-settings"],
    queryFn: () => api.get<IntegrationSettings[]>("/tenant/integrations"),
    staleTime: 60_000,
  });
  // Default true while loading so the nav item doesn't flash away and back on every mount.
  return query.data?.some((s) => s.planEnabled) ?? true;
}
