import { Schema, model, type InferSchemaType, Types } from "mongoose";

const customerSessionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },

    sessionTokenHash: { type: String, required: true },

    active: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

customerSessionSchema.index({ sessionTokenHash: 1 }, { unique: true });
customerSessionSchema.index({ tenantId: 1, branchId: 1, tableId: 1 });
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CustomerSessionDocument = InferSchemaType<typeof customerSessionSchema> & {
  _id: Types.ObjectId;
};
export const CustomerSession = model("CustomerSession", customerSessionSchema);
