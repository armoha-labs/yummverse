import { Schema, model, type InferSchemaType, Types } from "mongoose";
import { PAYMENT_PROVIDERS } from "./TenantPaymentSettings.js";

const webhookEventSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
  providerEventId: { type: String, required: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date, default: Date.now, required: true },
});

webhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });

export type WebhookEventDocument = InferSchemaType<typeof webhookEventSchema> & { _id: Types.ObjectId };
export const WebhookEvent = model("WebhookEvent", webhookEventSchema);
