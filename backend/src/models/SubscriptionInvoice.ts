import { Schema, model, type InferSchemaType, Types } from "mongoose";
import { PLAN_IDS } from "../config/plans.js";

// DRAFT: generated but not yet emailed. SENT: emailed to the tenant admin. PAID: Platform
// Admin has manually recorded payment (§47A) — there's no platform-level payment gateway
// in this build, so this is a billing record, not a live payment collection flow.
export const SUBSCRIPTION_INVOICE_STATUSES = ["DRAFT", "SENT", "PAID"] as const;
export type SubscriptionInvoiceStatus = (typeof SUBSCRIPTION_INVOICE_STATUSES)[number];

const subscriptionInvoiceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    invoiceNumber: { type: String, required: true },

    planId: { type: String, enum: PLAN_IDS, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    status: { type: String, enum: SUBSCRIPTION_INVOICE_STATUSES, default: "DRAFT", required: true },
    sentAt: { type: Date },
    paidAt: { type: Date },

    generatedByPlatformAdminId: { type: Schema.Types.ObjectId, ref: "PlatformAdmin" },
  },
  { timestamps: true },
);

subscriptionInvoiceSchema.index({ tenantId: 1, createdAt: -1 });
subscriptionInvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

export type SubscriptionInvoiceDocument = InferSchemaType<typeof subscriptionInvoiceSchema> & {
  _id: Types.ObjectId;
};
export const SubscriptionInvoice = model("SubscriptionInvoice", subscriptionInvoiceSchema);
