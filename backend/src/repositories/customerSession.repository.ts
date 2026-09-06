import { CustomerSession } from "../models/CustomerSession.js";
import { Types } from "mongoose";

export const customerSessionRepository = {
  create(input: {
    tenantId: string | Types.ObjectId;
    branchId: string | Types.ObjectId;
    tableId: string | Types.ObjectId;
    sessionTokenHash: string;
    expiresAt: Date;
  }) {
    return CustomerSession.create(input);
  },

  findActiveByTokenHash(tokenHash: string) {
    return CustomerSession.findOne({ sessionTokenHash: tokenHash, active: true, expiresAt: { $gt: new Date() } });
  },

  closeForTable(tenantId: string | Types.ObjectId, tableId: string | Types.ObjectId) {
    return CustomerSession.updateMany({ tenantId, tableId, active: true }, { active: false });
  },
};
