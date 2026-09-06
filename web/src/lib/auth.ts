import { useSyncExternalStore } from "react";
import { tokenStore, type StoredAuth, type StaffRole } from "./tokenStore";
import { api } from "./apiClient";

export function useAuth(): StoredAuth | null {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.get);
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface Me {
  role: StaffRole;
  name: string;
  tenantId?: string;
  branchId?: string;
}

/** §32: tenant is resolved from the URL slug before any credential is checked. */
export async function loginStaff(tenantSlug: string, email: string, password: string): Promise<void> {
  const tokens = await api.post<TokenPair>("/auth/login", { tenantSlug, email, password });
  tokenStore.set({ ...tokens, role: "TENANT_ADMIN", tenantSlug });
  const me = await api.get<Me>("/auth/me");
  tokenStore.set({ ...tokens, role: me.role, tenantId: me.tenantId, branchId: me.branchId, tenantSlug, name: me.name });
}

export async function loginPlatformAdmin(email: string, password: string): Promise<void> {
  const tokens = await api.post<TokenPair>("/platform/auth/login", { email, password });
  tokenStore.set({ ...tokens, role: "PLATFORM_ADMIN" });
  const me = await api.get<Me>("/auth/me");
  tokenStore.set({ ...tokens, role: "PLATFORM_ADMIN", name: me.name });
}

export async function logout(): Promise<void> {
  const auth = tokenStore.get();
  if (auth?.refreshToken) {
    try {
      await api.post("/auth/logout", { refreshToken: auth.refreshToken });
    } catch {
      // best-effort — clearing local state below is what actually matters
    }
  }
  tokenStore.set(null);
}
