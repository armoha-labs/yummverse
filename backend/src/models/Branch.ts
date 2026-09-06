import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const BRANCH_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

const branchSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },

    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    isDefault: { type: Boolean, default: false },

    address: {
      line1: { type: String },
      line2: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },

    contact: {
      phone: { type: String },
      email: { type: String },
    },

    timezone: { type: String },

    // No defaults here, deliberately: absent means "inherit the tenant default" (§6A.2),
    // which is a different thing from an override that explicitly disables tax/service charge.
    settings: {
      type: {
        tax: {
          type: { enabled: { type: Boolean, required: true }, percentage: { type: Number, required: true } },
          required: false,
          _id: false,
        },
        serviceCharge: {
          type: { enabled: { type: Boolean, required: true }, percentage: { type: Number, required: true } },
          required: false,
          _id: false,
        },
        // Absent means "inherit the tenant default", same rule as tax/serviceCharge above.
        payment: {
          type: { allowPayLater: { type: Boolean, required: true } },
          required: false,
          _id: false,
        },
      },
      required: false,
      _id: false,
    },

    status: { type: String, enum: BRANCH_STATUSES, default: "ACTIVE", required: true },
  },
  { timestamps: true },
);

branchSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, status: 1 });

export type BranchDocument = InferSchemaType<typeof branchSchema> & { _id: Types.ObjectId };
export const Branch = model("Branch", branchSchema);
