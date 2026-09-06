import { TenantSettings } from "../models/TenantSettings.js";
import { Types } from "mongoose";

export const tenantSettingsRepository = {
  findByTenant(tenantId: string | Types.ObjectId) {
    return TenantSettings.findOne({ tenantId });
  },

  createDefault(tenantId: string | Types.ObjectId, defaults?: { currency?: string; timezone?: string }) {
    return TenantSettings.create({ tenantId, ...defaults });
  },
};
