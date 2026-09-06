import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const ORDER_CHANNELS = ["QR", "POS"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
export type OrderPaymentStatus = (typeof PAYMENT_STATUSES)[number];

const orderItemSchema = new Schema(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxPercentage: { type: Number, required: true, min: 0, max: 100 },
    total: { type: Number, required: true, min: 0 },
    note: { type: String },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },

    channel: { type: String, enum: ORDER_CHANNELS, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table" }, // required for QR; null for POS takeaway

    orderNumber: { type: Number, required: true },

    customer: {
      sessionId: { type: Schema.Types.ObjectId, ref: "CustomerSession" }, // QR orders only
      // Required for QR customers (§23); POS orders default this server-side since the
      // POS UI has no name field (§23A.4).
      name: { type: String, required: true },
      phone: { type: String },
    },

    createdByUserId: { type: Schema.Types.ObjectId, ref: "User" }, // POS orders only

    items: { type: [orderItemSchema], required: true },

    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    serviceCharge: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "PENDING", required: true },
    paymentMethod: { type: String },

    orderStatus: { type: String, enum: ORDER_STATUSES, default: "PENDING_PAYMENT", required: true },

    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },

    acceptedAt: { type: Date },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    servedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, branchId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, tableId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, branchId: 1, orderNumber: 1 }, { unique: true });

export type OrderDocument = InferSchemaType<typeof orderSchema> & { _id: Types.ObjectId };
export const Order = model("Order", orderSchema);
