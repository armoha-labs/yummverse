import { Schema, model, type InferSchemaType, Types } from "mongoose";

const tenantFeatureLimitsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },

    overrides: {
      maxTables: { type: Number },
      maxStaffUsers: { type: Number },
      maxOrdersPerMonth: { type: Number },
      advancedReports: { type: Boolean },
      customBranding: { type: Boolean },
      allowedPaymentProviders: { type: [String] },
      paymentGatewayEnabled: { type: Boolean },
      thermalPrintingEnabled: { type: Boolean },
      eInvoiceWhatsappEnabled: { type: Boolean },
      firebasePushEnabled: { type: Boolean },
      swiggyIntegrationEnabled: { type: Boolean },
      zomatoIntegrationEnabled: { type: Boolean },
    },

    updatedByPlatformAdminId: { type: Schema.Types.ObjectId, ref: "PlatformAdmin" },
  },
  { timestamps: true },
);

export type TenantFeatureLimitsDocument = InferSchemaType<typeof tenantFeatureLimitsSchema> & {
  _id: Types.ObjectId;
};
export const TenantFeatureLimits = model("TenantFeatureLimits", tenantFeatureLimitsSchema);
