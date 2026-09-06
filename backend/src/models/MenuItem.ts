import { Schema, model, type InferSchemaType, Types } from "mongoose";

const menuItemSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    name: { type: String, required: true, trim: true },
    description: { type: String },
    imageUrl: { type: String },

    price: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, default: 0, min: 0, max: 100 },

    isAvailable: { type: Boolean, default: true },
    active: { type: Boolean, default: true },

    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

menuItemSchema.index({ tenantId: 1, categoryId: 1 });
menuItemSchema.index({ tenantId: 1, active: 1 });
menuItemSchema.index({ tenantId: 1, isAvailable: 1 });

export type MenuItemDocument = InferSchemaType<typeof menuItemSchema> & { _id: Types.ObjectId };
export const MenuItem = model("MenuItem", menuItemSchema);
