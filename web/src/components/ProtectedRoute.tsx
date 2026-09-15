import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { StaffRole } from "@/lib/tokenStore";

const STAFF_LOGIN_SEGMENT: Record<"TENANT_ADMIN" | "WAITER" | "KITCHEN", string> = {
  TENANT_ADMIN: "admin",
  WAITER: "waiter",
  KITCHEN: "kitchen",
};

export function ProtectedRoute({ role, children }: { role: StaffRole; children: ReactNode }) {
  const auth = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();

  if (role === "PLATFORM_ADMIN") {
    if (!auth || auth.role !== "PLATFORM_ADMIN") {
      window.location.assign("/platform/login");
      return null;
    }
    return <>{children}</>;
  }

  // Every tenant-scoped route carries the café slug in the URL (§32) — an authenticated
  // session for a DIFFERENT café must never render here. auth lives in localStorage, shared
  // across browser tabs, so this is the guard that stops one tab's login from leaking into
  // another tab that has a different café's slug in its URL: bounce to THIS café's own login
  // rather than silently showing the wrong tenant's data (or none, if the role also mismatches).
  if (!auth || auth.role !== role || auth.tenantSlug !== tenantSlug) {
    const segment = STAFF_LOGIN_SEGMENT[role as "TENANT_ADMIN" | "WAITER" | "KITCHEN"];
    const path = tenantSlug ? `/${tenantSlug}/${segment}/login` : "/platform/login";
    window.location.assign(path);
    return null;
  }

  return <>{children}</>;
}
