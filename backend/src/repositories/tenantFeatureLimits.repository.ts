import { TenantFeatureLimits } from "../models/TenantFeatureLimits.js";
import { Types } from "mongoose";

export const tenantFeatureLimitsRepository = {
  findByTenant(tenantId: string | Types.ObjectId) {
    return TenantFeatureLimits.findOne({ tenantId });
  },

  upsert(tenantId: string | Types.ObjectId, overrides: Record<string, unknown>, platformAdminId: string) {
    return TenantFeatureLimits.findOneAndUpdate(
      { tenantId },
      { $set: { overrides, updatedByPlatformAdminId: platformAdminId } },
      { upsert: true, new: true },
    );
  },
};
