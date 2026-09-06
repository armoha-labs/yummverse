import { User, type StaffRole } from "../models/User.js";
import { Types } from "mongoose";

export const userRepository = {
  // Always scoped to tenantId — never a bare email lookup across tenants (§32).
  findByTenantAndEmail(tenantId: string | Types.ObjectId, email: string) {
    return User.findOne({ tenantId, email: email.toLowerCase() });
  },

  findById(tenantId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    return User.findOne({ _id: userId, tenantId });
  },

  findTenantAdmin(tenantId: string | Types.ObjectId) {
    return User.findOne({ tenantId, role: "TENANT_ADMIN" });
  },

  create(input: {
    tenantId: string | Types.ObjectId;
    branchId?: string | Types.ObjectId;
    name: string;
    email: string;
    phone?: string;
    role: StaffRole;
  }) {
    return User.create({ ...input, email: input.email.toLowerCase() });
  },

  listForTenant(tenantId: string | Types.ObjectId, role?: StaffRole | StaffRole[]) {
    const roleFilter = Array.isArray(role) ? { $in: role } : role;
    return User.find({ tenantId, ...(roleFilter ? { role: roleFilter } : {}) }).sort({ createdAt: -1 });
  },
};
