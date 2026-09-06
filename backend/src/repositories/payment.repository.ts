import { Payment } from "../models/Payment.js";
import { Types } from "mongoose";

export const paymentRepository = {
  create(input: Record<string, unknown>) {
    return Payment.create(input);
  },

  findById(tenantId: string | Types.ObjectId, paymentId: string | Types.ObjectId) {
    return Payment.findOne({ _id: paymentId, tenantId });
  },

  findByProviderOrderId(providerOrderId: string) {
    return Payment.findOne({ providerOrderId });
  },

  findForOrder(tenantId: string | Types.ObjectId, orderId: string | Types.ObjectId) {
    return Payment.findOne({ tenantId, orderId }).sort({ createdAt: -1 });
  },
};
