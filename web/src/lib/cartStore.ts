import { useSyncExternalStore } from "react";

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  taxPercentage: number;
  quantity: number;
  /** Special request for this item (e.g. "no onions") — applies to the whole line. */
  note?: string;
}

interface CartData {
  tenantId: string;
  tableId: string;
  items: CartItem[];
}

const STORAGE_KEY = "yummverse.cart";
const listeners = new Set<() => void>();

function load(): CartData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartData) : null;
  } catch {
    return null;
  }
}

let current: CartData | null = load();

function persist(): void {
  try {
    if (current) localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — in-memory state still works for the current tab.
  }
  for (const listener of listeners) listener();
}

export const cartStore = {
  get(): CartData | null {
    return current;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** A cart only ever belongs to one table at a time — scanning a different table's QR
   * starts a fresh one rather than merging orders across tables. */
  ensureFor(tenantId: string, tableId: string): void {
    if (current?.tenantId === tenantId && current?.tableId === tableId) return;
    current = { tenantId, tableId, items: [] };
    persist();
  },
  addItem(item: Omit<CartItem, "quantity">, quantity = 1): void {
    if (!current) return;
    const existing = current.items.find((i) => i.menuItemId === item.menuItemId);
    current.items = existing
      ? current.items.map((i) => (i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + quantity } : i))
      : [...current.items, { ...item, quantity }];
    persist();
  },
  setQuantity(menuItemId: string, quantity: number): void {
    if (!current) return;
    current.items =
      quantity <= 0
        ? current.items.filter((i) => i.menuItemId !== menuItemId)
        : current.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i));
    persist();
  },
  setNote(menuItemId: string, note: string): void {
    if (!current) return;
    current.items = current.items.map((i) =>
      i.menuItemId === menuItemId ? { ...i, note: note.trim() === "" ? undefined : note } : i,
    );
    persist();
  },
  clear(): void {
    if (!current) return;
    current = { ...current, items: [] };
    persist();
  },
};

export function useCart(): CartItem[] {
  return useSyncExternalStore(
    cartStore.subscribe,
    () => cartStore.get()?.items ?? [],
    () => cartStore.get()?.items ?? [],
  );
}
