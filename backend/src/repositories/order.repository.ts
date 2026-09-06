import { Order } from "../models/Order.js";
import { Types } from "mongoose";

export const orderRepository = {
  create(input: Record<string, unknown>) {
    return Order.create(input);
  },

  // Always scoped to tenantId (§35) — never a bare findById for a tenant-owned resource.
  findById(tenantId: string | Types.ObjectId, orderId: string | Types.ObjectId) {
    return Order.findOne({ _id: orderId, tenantId });
  },

  listForBranch(tenantId: string | Types.ObjectId, branchId: string | Types.ObjectId, status?: string) {
    return Order.find({ tenantId, branchId, ...(status ? { orderStatus: status } : {}) }).sort({
      createdAt: -1,
    });
  },
};
