import { useSyncExternalStore } from "react";

export interface CustomerAuth {
  sessionToken: string;
  qrToken: string;
  expiresAt: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  tenantName: string;
  tenantSlug: string;
  currency: string;
  tableNumber: string;
  allowPayLater: boolean;
  kitchenEnabled: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

const STORAGE_KEY = "yummverse.customer";
const listeners = new Set<() => void>();

function load(): CustomerAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerAuth) : null;
  } catch {
    return null;
  }
}

let current: CustomerAuth | null = load();

export const customerAuthStore = {
  get(): CustomerAuth | null {
    return current;
  },
  set(auth: CustomerAuth | null): void {
    current = auth;
    try {
      if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable — in-memory state still works for the current tab.
    }
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useCustomerAuth(): CustomerAuth | null {
  return useSyncExternalStore(customerAuthStore.subscribe, customerAuthStore.get, customerAuthStore.get);
}
