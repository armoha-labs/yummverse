import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./apiClient";
import { useAuth } from "./auth";

interface TenantProfile {
  name: string;
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

interface PublicBranding {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

function applyThemeVars(primaryColor?: string, secondaryColor?: string) {
  const root = document.documentElement;
  if (primaryColor) root.style.setProperty("--accent", primaryColor);
  if (secondaryColor) root.style.setProperty("--secondary", secondaryColor);
  return () => {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--secondary");
  };
}

/** Waiter/Kitchen aren't allowed to call /tenant/profile (Tenant Admin only) — this uses the
 * public-by-slug branding lookup instead (§32), which is safe for any authenticated role. */
export function useStaffBranding() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ["public-branding", auth?.tenantSlug],
    queryFn: () => api.get<PublicBranding>(`/public/tenant/branding?tenantSlug=${encodeURIComponent(auth!.tenantSlug!)}`),
    enabled: Boolean(auth?.tenantSlug),
    staleTime: 5 * 60_000,
  });

  useEffect(() => applyThemeVars(query.data?.primaryColor, query.data?.secondaryColor), [query.data]);

  return query;
}

/** Applies the signed-in tenant's brand colors as CSS custom properties on <html> (§31A) —
 * every café-branded screen picks these up automatically via the existing var(--accent) etc.
 * Sourced from /tenant/profile (not /tenant/branding) since the admin shell also needs the
 * café's name, which is profile data rather than branding data. */
export function useTenantBranding() {
  const query = useQuery({
    queryKey: ["tenant-profile"],
    queryFn: () => api.get<TenantProfile>("/tenant/profile"),
    staleTime: 5 * 60_000,
  });

  useEffect(
    () => applyThemeVars(query.data?.branding?.primaryColor, query.data?.branding?.secondaryColor),
    [query.data],
  );

  return query;
}
