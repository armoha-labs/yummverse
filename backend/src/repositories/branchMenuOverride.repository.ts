import { BranchMenuOverride } from "../models/BranchMenuOverride.js";
import { Types } from "mongoose";

export const branchMenuOverrideRepository = {
  listForMenuItem(tenantId: string | Types.ObjectId, menuItemId: string | Types.ObjectId) {
    return BranchMenuOverride.find({ tenantId, menuItemId });
  },

  listForBranch(tenantId: string | Types.ObjectId, branchId: string | Types.ObjectId) {
    return BranchMenuOverride.find({ tenantId, branchId });
  },

  async upsert(
    tenantId: string | Types.ObjectId,
    branchId: string | Types.ObjectId,
    menuItemId: string | Types.ObjectId,
    isAvailable: boolean,
  ) {
    return BranchMenuOverride.findOneAndUpdate(
      { tenantId, branchId, menuItemId },
      { isAvailable },
      { upsert: true, new: true },
    );
  },
};
