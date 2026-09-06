import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const DEVICE_OWNER_TYPES = ["USER", "CUSTOMER_SESSION"] as const;
export type DeviceOwnerType = (typeof DEVICE_OWNER_TYPES)[number];

export const DEVICE_PLATFORMS = ["ANDROID", "IOS", "WEB"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

const deviceTokenSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    // Required for WAITER/KITCHEN; derived from the table for a customer session; unset
    // for TENANT_ADMIN (§40A.2) — same branch-scoping discipline as every other collection.
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },

    ownerType: { type: String, enum: DEVICE_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },

    platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
    fcmToken: { type: String, required: true },
  },
  { timestamps: true },
);

deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });
deviceTokenSchema.index({ tenantId: 1, branchId: 1, ownerType: 1 });

export type DeviceTokenDocument = InferSchemaType<typeof deviceTokenSchema> & { _id: Types.ObjectId };
export const DeviceToken = model("DeviceToken", deviceTokenSchema);
