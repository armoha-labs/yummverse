import { Branch } from "../models/Branch.js";
import { Types } from "mongoose";

export const branchRepository = {
  createDefault(tenantId: string | Types.ObjectId) {
    return Branch.create({
      tenantId,
      name: "Main Branch",
      slug: "main",
      isDefault: true,
      status: "ACTIVE",
    });
  },

  findDefaultForTenant(tenantId: string | Types.ObjectId) {
    return Branch.findOne({ tenantId, isDefault: true });
  },

  // Always scoped to tenantId — never trust a branchId alone (§5.1, §6A.5).
  findById(tenantId: string | Types.ObjectId, branchId: string | Types.ObjectId) {
    return Branch.findOne({ _id: branchId, tenantId });
  },

  listForTenant(tenantId: string | Types.ObjectId) {
    return Branch.find({ tenantId }).sort({ createdAt: 1 });
  },
};
