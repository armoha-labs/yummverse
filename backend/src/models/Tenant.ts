import { Schema, model, type InferSchemaType } from "mongoose";
import { PLAN_IDS } from "../config/plans.js";

export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL", "CANCELLED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },

    branding: {
      logoUrl: { type: String },
      logoAssetId: { type: String },
      primaryColor: { type: String },
      secondaryColor: { type: String },
      faviconUrl: { type: String },
    },

    contact: {
      phone: { type: String },
      email: { type: String },
    },

    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },

    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },

    status: { type: String, enum: TENANT_STATUSES, default: "TRIAL", required: true },

    subscription: {
      planId: { type: String, enum: PLAN_IDS, default: "FREE" },
      status: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      trialEndsAt: { type: Date },
    },
  },
  { timestamps: true },
);

tenantSchema.index({ slug: 1 }, { unique: true });
tenantSchema.index({ status: 1 });

export type TenantDocument = InferSchemaType<typeof tenantSchema>;
export const Tenant = model("Tenant", tenantSchema);
