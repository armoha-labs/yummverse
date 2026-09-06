import { Schema, model, type InferSchemaType, Types } from "mongoose";

const tenantSettingsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },

    tax: {
      enabled: { type: Boolean, default: false },
      percentage: { type: Number, default: 0 },
    },

    serviceCharge: {
      enabled: { type: Boolean, default: false },
      percentage: { type: Number, default: 0 },
    },

    ordering: {
      enabled: { type: Boolean, default: true },
      allowMultipleOrdersPerTable: { type: Boolean, default: true },
      collectCustomerPhone: { type: Boolean, default: true },
    },

    payment: {
      // Tenant-wide default for "pay at the counter instead of online" (§23) — a branch can
      // override this via Branch.settings.payment.allowPayLater.
      allowPayLater: { type: Boolean, default: false },
    },

    notifications: {
      soundEnabled: { type: Boolean, default: true },
      browserPushEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export type TenantSettingsDocument = InferSchemaType<typeof tenantSettingsSchema> & {
  _id: Types.ObjectId;
};
export const TenantSettings = model("TenantSettings", tenantSettingsSchema);
