import { useQuery } from "@tanstack/react-query";
import { api } from "./apiClient";

interface WaiterSettings {
  kitchenEnabled: boolean;
  tableStatusEnabled: boolean;
}

interface KitchenSettings {
  kitchenEnabled: boolean;
}

/** Waiter is always locked to one branch (§6A.5), so this reflects that branch's own
 * kitchen/table-status override, not just the tenant-wide default. */
export function useWaiterSettings() {
  return useQuery({
    queryKey: ["waiter-settings"],
    queryFn: () => api.get<WaiterSettings>("/waiter/settings"),
    staleTime: 60_000,
  });
}

/** Same branch-aware resolution as useWaiterSettings, for the Kitchen Display role. */
export function useKitchenSettings() {
  return useQuery({
    queryKey: ["kitchen-settings"],
    queryFn: () => api.get<KitchenSettings>("/kitchen/settings"),
    staleTime: 60_000,
  });
}
