import { DeviceToken, type DeviceOwnerType, type DevicePlatform, type DeviceStaffRole } from "../models/DeviceToken.js";
import { Types } from "mongoose";

export const deviceTokenRepository = {
  register(input: {
    tenantId: string | Types.ObjectId;
    branchId?: string | Types.ObjectId;
    ownerType: DeviceOwnerType;
    ownerId: string | Types.ObjectId;
    role?: DeviceStaffRole;
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

  // Branch-locked staff (Kitchen/Waiter) — scoped to tenantId+branchId+role so each role
  // gets only the notifications meant for it, never every branch-scoped USER token (§40A.2's
  // explicit "never an unscoped 'all tokens' query" warning still applies here).
  findForBranchRole(tenantId: string, branchId: string, role: DeviceStaffRole) {
    return DeviceToken.find({ tenantId, branchId, role });
  },

  // Tenant Admin isn't branch-locked (§6A.5) — their token has no branchId, so reaching them
  // needs a tenant-wide lookup rather than the branch-scoped one above.
  findForTenantRole(tenantId: string, role: DeviceStaffRole) {
    return DeviceToken.find({ tenantId, role });
  },

  findForOwner(tenantId: string, ownerType: DeviceOwnerType, ownerId: string) {
    return DeviceToken.find({ tenantId, ownerType, ownerId });
  },
};
