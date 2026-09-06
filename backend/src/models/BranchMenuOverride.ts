import { Schema, model, type InferSchemaType, Types } from "mongoose";

const branchMenuOverrideSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },

    isAvailable: { type: Boolean, required: true },
  },
  { timestamps: true },
);

branchMenuOverrideSchema.index({ tenantId: 1, branchId: 1, menuItemId: 1 }, { unique: true });

export type BranchMenuOverrideDocument = InferSchemaType<typeof branchMenuOverrideSchema> & {
  _id: Types.ObjectId;
};
export const BranchMenuOverride = model("BranchMenuOverride", branchMenuOverrideSchema);
