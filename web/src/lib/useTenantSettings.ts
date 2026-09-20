import { useQuery } from "@tanstack/react-query";
import { api } from "./apiClient";

interface TenantSettings {
  ordering: { kitchenEnabled: boolean; tableStatusEnabled: boolean };
}

/** Tenant Admin only (unlike useStaffBranding's public lookup, which Waiter/Kitchen use for
 * the same two flags) — shares the ["tenant-settings"] query with SettingsPage's OperationsTab,
 * so calling this elsewhere never triggers an extra network request. */
export function useTenantSettings() {
  return useQuery({
    queryKey: ["tenant-settings"],
    queryFn: () => api.get<TenantSettings>("/tenant/settings"),
    staleTime: 60_000,
  });
}
