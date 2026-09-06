import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const PAYMENT_PROVIDERS = ["RAZORPAY", "STRIPE", "PAYPAL", "OTHER"] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

const tenantPaymentSettingsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    // Optional — omitted means "tenant-wide default" (§6A.3)
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },

    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },

    credentials: {
      keyId: { type: String },
      keySecretEncrypted: { type: String },
      webhookSecretEncrypted: { type: String },
    },

    currency: { type: String, default: "INR" },
    enabled: { type: Boolean, default: false },
    testMode: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// One row per (tenant, branch|default) pair; branchId is normalized to a real ObjectId or
// null so the partial-filter unique index behaves consistently.
tenantPaymentSettingsSchema.index(
  { tenantId: 1, branchId: 1 },
  { unique: true },
);

export type TenantPaymentSettingsDocument = InferSchemaType<typeof tenantPaymentSettingsSchema> & {
  _id: Types.ObjectId;
};
export const TenantPaymentSettings = model("TenantPaymentSettings", tenantPaymentSettingsSchema);
