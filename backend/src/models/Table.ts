import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED"] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

const tableSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },

    tableNumber: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true },

    active: { type: Boolean, default: true },
    status: { type: String, enum: TABLE_STATUSES, default: "AVAILABLE", required: true },
    currentOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true },
);

tableSchema.index({ tenantId: 1, branchId: 1, tableNumber: 1 }, { unique: true });
tableSchema.index({ qrToken: 1 }, { unique: true });

export type TableDocument = InferSchemaType<typeof tableSchema> & { _id: Types.ObjectId };
export const Table = model("Table", tableSchema);
