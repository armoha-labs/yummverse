import { DeviceToken, type DeviceOwnerType, type DevicePlatform } from "../models/DeviceToken.js";
import { Types } from "mongoose";

export const deviceTokenRepository = {
  register(input: {
    tenantId: string | Types.ObjectId;
    branchId?: string | Types.ObjectId;
    ownerType: DeviceOwnerType;
    ownerId: string | Types.ObjectId;
    platform: DevicePlatform;
    fcmToken: string;
  }) {
    return DeviceToken.findOneAndUpdate(
      { fcmToken: input.fcmToken },
      { $set: input },
      { upsert: true, new: true },
    );
  },

  deregister(fcmToken: string) {
    return DeviceToken.deleteOne({ fcmToken });
  },

  removeInvalid(fcmToken: string) {
    return DeviceToken.deleteOne({ fcmToken });
  },

  // Always scoped to tenantId (+branchId for branch-locked roles) — never an unscoped
  // "all tokens" query (§40A.2's explicit warning).
  findForOwnerType(tenantId: string, branchId: string, ownerType: DeviceOwnerType) {
    return DeviceToken.find({ tenantId, branchId, ownerType });
  },

  findForOwner(tenantId: string, ownerType: DeviceOwnerType, ownerId: string) {
    return DeviceToken.find({ tenantId, ownerType, ownerId });
  },
};
