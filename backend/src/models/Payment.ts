import { Schema, model, type InferSchemaType, Types } from "mongoose";
import { PAYMENT_PROVIDERS } from "./TenantPaymentSettings.js";

export const PAYMENT_RECORD_STATUSES = [
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

const paymentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },

    // Unset for a CASH payment (§23A.3) — cash orders skip PaymentProvider entirely.
    provider: { type: String, enum: PAYMENT_PROVIDERS },

    providerOrderId: { type: String },
    providerPaymentId: { type: String },

    amount: { type: Number, required: true, min: 0 },
    // Cumulative total refunded so far — lets a payment be refunded in more than one partial
    // instalment before `status` finally flips to REFUNDED once it reaches `amount`.
    refundedAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, required: true },

    status: { type: String, enum: PAYMENT_RECORD_STATUSES, default: "CREATED", required: true },

    method: { type: String }, // gateway-reported (UPI/Card/Wallet/...), or "CASH" for POS (§23A.3)

    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, orderId: 1 });
paymentSchema.index(
  { providerOrderId: 1 },
  { unique: true, partialFilterExpression: { providerOrderId: { $type: "string" } } },
);
paymentSchema.index(
  { providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } } },
);

export type PaymentDocument = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const Payment = model("Payment", paymentSchema);
