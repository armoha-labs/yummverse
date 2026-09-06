import { TenantIntegrationSettings } from "../models/TenantIntegrationSettings.js";
import type { IntegrationProviderName } from "../models/TenantIntegrationSettings.js";
import { Types } from "mongoose";

export const tenantIntegrationSettingsRepository = {
  listForTenant(tenantId: string | Types.ObjectId) {
    return TenantIntegrationSettings.find({ tenantId });
  },

  findOne(tenantId: string | Types.ObjectId, provider: IntegrationProviderName) {
    return TenantIntegrationSettings.findOne({ tenantId, provider });
  },

  async upsert(
    tenantId: string | Types.ObjectId,
    provider: IntegrationProviderName,
    data: Partial<{ enabled: boolean; outletId: string; apiKeyEncrypted: string }>,
  ) {
    const existing = await TenantIntegrationSettings.findOne({ tenantId, provider });
    const doc = existing ?? new TenantIntegrationSettings({ tenantId, provider });

    if (data.enabled !== undefined) doc.enabled = data.enabled;
    if (data.outletId !== undefined) doc.outletId = data.outletId;
    if (data.apiKeyEncrypted !== undefined) doc.apiKeyEncrypted = data.apiKeyEncrypted;

    await doc.save();
    return doc;
  },
};
