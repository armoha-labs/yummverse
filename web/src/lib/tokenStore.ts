export type StaffRole = "PLATFORM_ADMIN" | "TENANT_ADMIN" | "WAITER" | "KITCHEN";

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  role: StaffRole;
  tenantId?: string;
  tenantSlug?: string;
  branchId?: string;
  name?: string;
}

const STORAGE_KEY = "yummverse.auth";
const listeners = new Set<() => void>();

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

let current: StoredAuth | null = load();

export const tokenStore = {
  get(): StoredAuth | null {
    return current;
  },
  set(auth: StoredAuth | null): void {
    current = auth;
    try {
      if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private browsing etc.) — in-memory state still works
      // for the current tab.
    }
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
