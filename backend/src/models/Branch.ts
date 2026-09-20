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

    status: { type: String, enum: BRANCH_STATUSES, default: "ACTIVE", required: true },
  },
  { timestamps: true },
);

branchSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, status: 1 });

export type BranchDocument = InferSchemaType<typeof branchSchema> & { _id: Types.ObjectId };
export const Branch = model("Branch", branchSchema);
