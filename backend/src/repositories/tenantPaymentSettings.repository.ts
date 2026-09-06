import { TenantPaymentSettings } from "../models/TenantPaymentSettings.js";
import { Types } from "mongoose";

type BranchId = string | Types.ObjectId | null | undefined;

function normalize(branchId: BranchId): Types.ObjectId | null {
  return branchId ? new Types.ObjectId(branchId) : null;
}

export const tenantPaymentSettingsRepository = {
  /** Exact row for this (tenant, branch) pair — no fallback. */
  findExact(tenantId: string | Types.ObjectId, branchId: BranchId) {
    return TenantPaymentSettings.findOne({ tenantId, branchId: normalize(branchId) });
  },

  /** Resolution order per §6A.3: branch-specific row, else the tenant-wide default. */
  async findResolved(tenantId: string | Types.ObjectId, branchId: BranchId) {
    if (branchId) {
      const branchSpecific = await TenantPaymentSettings.findOne({
        tenantId,
        branchId: normalize(branchId),
      });
      if (branchSpecific) return branchSpecific;
    }
    return TenantPaymentSettings.findOne({ tenantId, branchId: null });
  },

  async upsert(
    tenantId: string | Types.ObjectId,
    branchId: BranchId,
    data: Partial<{
      provider: string;
      currency: string;
      enabled: boolean;
      testMode: boolean;
      keyId: string;
      keySecretEncrypted: string;
      webhookSecretEncrypted: string;
    }>,
  ) {
    const normalizedBranchId = normalize(branchId);
    const existing = await TenantPaymentSettings.findOne({ tenantId, branchId: normalizedBranchId });

    const doc = existing ?? new TenantPaymentSettings({ tenantId, branchId: normalizedBranchId });

    if (data.provider !== undefined) doc.provider = data.provider as never;
    if (data.currency !== undefined) doc.currency = data.currency;
    if (data.enabled !== undefined) doc.enabled = data.enabled;
    if (data.testMode !== undefined) doc.testMode = data.testMode;

    doc.credentials ??= {};
    if (data.keyId !== undefined) doc.credentials.keyId = data.keyId;
    if (data.keySecretEncrypted !== undefined) doc.credentials.keySecretEncrypted = data.keySecretEncrypted;
    if (data.webhookSecretEncrypted !== undefined) {
      doc.credentials.webhookSecretEncrypted = data.webhookSecretEncrypted;
    }

    await doc.save();
    return { doc, providerChanged: existing ? existing.provider !== doc.provider : false };
  },

  deleteOverride(tenantId: string | Types.ObjectId, branchId: string | Types.ObjectId) {
    return TenantPaymentSettings.findOneAndDelete({ tenantId, branchId: normalize(branchId) });
  },
};
