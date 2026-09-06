import { Schema, model, type InferSchemaType, Types } from "mongoose";

const categorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String },
    imageUrl: { type: String },

    displayOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ tenantId: 1, displayOrder: 1 });
categorySchema.index({ tenantId: 1, active: 1 });

export type CategoryDocument = InferSchemaType<typeof categorySchema> & { _id: Types.ObjectId };
export const Category = model("Category", categorySchema);
