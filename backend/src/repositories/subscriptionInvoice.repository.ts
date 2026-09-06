import { SubscriptionInvoice } from "../models/SubscriptionInvoice.js";
import { Types } from "mongoose";

export const subscriptionInvoiceRepository = {
  listForTenant(tenantId: string | Types.ObjectId) {
    return SubscriptionInvoice.find({ tenantId }).sort({ createdAt: -1 });
  },

  findById(tenantId: string | Types.ObjectId, invoiceId: string) {
    return SubscriptionInvoice.findOne({ _id: invoiceId, tenantId });
  },

  create(data: {
    tenantId: string | Types.ObjectId;
    invoiceNumber: string;
    planId: string;
    amount: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    generatedByPlatformAdminId: string;
  }) {
    return SubscriptionInvoice.create(data);
  },
};
