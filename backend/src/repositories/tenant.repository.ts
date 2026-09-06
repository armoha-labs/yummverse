import { Tenant, type TenantStatus } from "../models/Tenant.js";
import { Types } from "mongoose";

export const tenantRepository = {
  findBySlug(slug: string) {
    return Tenant.findOne({ slug });
  },

  findById(tenantId: string | Types.ObjectId) {
    return Tenant.findById(tenantId);
  },

  create(input: {
    name: string;
    slug: string;
    contact?: { phone?: string; email?: string };
    planId?: string;
  }) {
    const { planId, ...rest } = input;
    return Tenant.create({
      ...rest,
      status: "TRIAL",
      subscription: planId ? { planId } : undefined,
    });
  },

  setStatus(tenantId: string | Types.ObjectId, status: TenantStatus) {
    return Tenant.findByIdAndUpdate(tenantId, { status }, { new: true });
  },

  list() {
    return Tenant.find().sort({ createdAt: -1 });
  },

  countActiveWithEndDateBefore(cutoff: Date) {
    return Tenant.countDocuments({
      status: "ACTIVE",
      "subscription.endDate": { $exists: true, $ne: null, $lte: cutoff },
    });
  },
};
