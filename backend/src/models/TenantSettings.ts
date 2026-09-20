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
      // Off for a café that has no back-of-house kitchen workflow (e.g. a takeaway counter
      // that just hands the order over) — when off, orders skip the Accept/Preparing/Ready
      // stages entirely and can be marked Served directly, and the Kitchen screens are hidden.
      kitchenEnabled: { type: Boolean, default: true },
      // Off for a café that doesn't want to track table occupancy at all (e.g. pure takeaway,
      // or counter service) — when off, tables never flip to OCCUPIED and the status badge is
      // hidden from the Tables/Waiter screens.
      tableStatusEnabled: { type: Boolean, default: true },
    },

    payment: {
      // Tenant-wide default for "pay at the counter instead of online" (§23) — a branch can
      // override this via Branch.settings.payment.allowPayLater.
      allowPayLater: { type: Boolean, default: false },
      // Off by default: the "Card (POS terminal)" collection method is currently a manual
      // staff-confirmed bookkeeping entry, not a real card-present integration (no terminal
      // SDK wired up yet) — a tenant enables this explicitly once that hardware/SDK is in
      // place. A branch can override via Branch.settings.payment.posCardEnabled.
      posCardEnabled: { type: Boolean, default: false },
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
