import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const INTEGRATION_PROVIDERS = ["SWIGGY", "ZOMATO"] as const;
export type IntegrationProviderName = (typeof INTEGRATION_PROVIDERS)[number];

const tenantIntegrationSettingsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },

    // The café's own on/off switch — separate from Platform Admin's plan-level gate
    // (PlanLimits.swiggyIntegrationEnabled / zomatoIntegrationEnabled).
    enabled: { type: Boolean, default: false },
    outletId: { type: String },
    apiKeyEncrypted: { type: String },
  },
  { timestamps: true },
);

tenantIntegrationSettingsSchema.index({ tenantId: 1, provider: 1 }, { unique: true });

export type TenantIntegrationSettingsDocument = InferSchemaType<typeof tenantIntegrationSettingsSchema> & {
  _id: Types.ObjectId;
};
export const TenantIntegrationSettings = model("TenantIntegrationSettings", tenantIntegrationSettingsSchema);
