import { branchRepository } from "../repositories/branch.repository.js";
import { tenantSettingsService } from "./tenantSettings.service.js";
import { menuItemRepository } from "../repositories/menuItem.repository.js";
import { branchMenuOverrideRepository } from "../repositories/branchMenuOverride.repository.js";
import { ApiError } from "../utils/ApiError.js";

interface RateSetting {
  enabled: boolean;
  percentage: number;
}

export interface OrderLineInput {
  unitPrice: number;
  quantity: number;
  taxPercentage: number;
}

export interface ResolvedOrderLine extends OrderLineInput {
  menuItemId: string;
  name: string;
  note?: string;
}

export interface RequestedOrderItem {
  menuItemId: string;
  quantity: number;
  note?: string;
}

async function resolveEffectiveAvailability(
  tenantId: string,
  branchId: string,
  menuItemId: string,
  fallback: boolean,
): Promise<boolean> {
  const overrides = await branchMenuOverrideRepository.listForMenuItem(tenantId, menuItemId);
  const branchOverride = overrides.find((o) => o.branchId.toString() === branchId);
  return branchOverride ? branchOverride.isAvailable : fallback;
}

/** Shared by QR (§23) and POS (§23A) order creation — same menu, same availability rules,
 * same historical price/name snapshot (§24), just a different order channel. */
export async function resolveOrderLines(
  tenantId: string,
  branchId: string,
  items: RequestedOrderItem[],
): Promise<ResolvedOrderLine[]> {
  if (items.length === 0) {
    throw ApiError.badRequest("EMPTY_ORDER", "An order must contain at least one item.");
  }

  const lines: ResolvedOrderLine[] = [];
  for (const requested of items) {
    const menuItem = await menuItemRepository.findById(tenantId, requested.menuItemId);
    if (!menuItem || !menuItem.active) {
      throw ApiError.badRequest("MENU_ITEM_UNAVAILABLE", `Item not found: ${requested.menuItemId}`);
    }

    const available = await resolveEffectiveAvailability(
      tenantId,
      branchId,
      requested.menuItemId,
      menuItem.isAvailable,
    );
    if (!available) {
      throw ApiError.badRequest("MENU_ITEM_UNAVAILABLE", `"${menuItem.name}" is currently unavailable.`);
    }

    lines.push({
      menuItemId: requested.menuItemId,
      name: menuItem.name,
      quantity: requested.quantity,
      unitPrice: menuItem.price,
      taxPercentage: menuItem.taxPercentage,
      note: requested.note,
    });
  }
  return lines;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  /** taxAmount split into GST's CGST + SGST components (Indian intra-state supply — the
   * standard case for a single dine-in/takeaway café). Always sums back to taxAmount. */
  cgstAmount: number;
  sgstAmount: number;
  serviceCharge: number;
  totalAmount: number;
}

/** Branch settings override the tenant default; an unset branch field inherits it (§6A.2). */
export async function resolveEffectiveRates(
  tenantId: string,
  branchId: string,
): Promise<{ tax: RateSetting; serviceCharge: RateSetting }> {
  const [branch, tenantSettings] = await Promise.all([
    branchRepository.findById(tenantId, branchId),
    tenantSettingsService.getOrCreate(tenantId),
  ]);

  return {
    tax: branch?.settings?.tax ?? tenantSettings.tax ?? { enabled: false, percentage: 0 },
    serviceCharge:
      branch?.settings?.serviceCharge ?? tenantSettings.serviceCharge ?? { enabled: false, percentage: 0 },
  };
}

/** Branch setting overrides the tenant default, same inheritance rule as tax/serviceCharge
 * above (§6A.2) — lets a café accept orders into the kitchen before payment and collect it
 * later (§23), per branch. */
export async function resolveAllowPayLater(tenantId: string, branchId: string): Promise<boolean> {
  const [branch, tenantSettings] = await Promise.all([
    branchRepository.findById(tenantId, branchId),
    tenantSettingsService.getOrCreate(tenantId),
  ]);
  return branch?.settings?.payment?.allowPayLater ?? tenantSettings.payment?.allowPayLater ?? false;
}

/** Same branch-overrides-tenant inheritance rule as above. Off by default everywhere — the
 * "Card (POS terminal)" collection method has no real card-present hardware/SDK wired up yet
 * (§23A.3), so a tenant switches this on only once that's actually in place. */
export async function resolvePosCardEnabled(tenantId: string, branchId: string): Promise<boolean> {
  const [branch, tenantSettings] = await Promise.all([
    branchRepository.findById(tenantId, branchId),
    tenantSettingsService.getOrCreate(tenantId),
  ]);
  return branch?.settings?.payment?.posCardEnabled ?? tenantSettings.payment?.posCardEnabled ?? false;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Tax is computed from each item's own `taxPercentage` (a GST-style per-item slab, §29,
 * §46.1.2's Tax Report groups by these rates) — the tenant/branch `tax` setting is a gate,
 * not a replacement rate: disabled means no tax is charged at all, regardless of item rates.
 * Service charge has no per-item equivalent; it's a flat percentage of the subtotal.
 */
export function calculateOrderTotals(
  lines: OrderLineInput[],
  rates: { tax: RateSetting; serviceCharge: RateSetting },
): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));

  const taxAmount = rates.tax.enabled
    ? round2(lines.reduce((sum, line) => sum + (line.unitPrice * line.quantity * line.taxPercentage) / 100, 0))
    : 0;

  // Split evenly between CGST and SGST — round the first half and give the second half
  // whatever remains, so they always sum back to taxAmount exactly even on an odd paisa.
  const cgstAmount = round2(taxAmount / 2);
  const sgstAmount = round2(taxAmount - cgstAmount);

  const serviceCharge = rates.serviceCharge.enabled
    ? round2((subtotal * rates.serviceCharge.percentage) / 100)
    : 0;

  return {
    subtotal,
    taxAmount,
    cgstAmount,
    sgstAmount,
    serviceCharge,
    totalAmount: round2(subtotal + taxAmount + serviceCharge),
  };
}
