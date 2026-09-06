import { Table } from "../models/Table.js";
import { Types } from "mongoose";

export const tableRepository = {
  listForTenant(tenantId: string | Types.ObjectId, branchId?: string | Types.ObjectId) {
    return Table.find({ tenantId, ...(branchId ? { branchId } : {}) }).sort({ tableNumber: 1 });
  },

  findById(tenantId: string | Types.ObjectId, tableId: string | Types.ObjectId) {
    return Table.findOne({ _id: tableId, tenantId });
  },

  findByTableNumber(
    tenantId: string | Types.ObjectId,
    branchId: string | Types.ObjectId,
    tableNumber: string,
  ) {
    return Table.findOne({ tenantId, branchId, tableNumber });
  },

  // Public/customer-facing lookup — token is the only trusted input (§5.3, §22).
  findByQrToken(qrToken: string) {
    return Table.findOne({ qrToken, active: true });
  },

  create(input: { tenantId: string | Types.ObjectId; branchId: string | Types.ObjectId; tableNumber: string; qrToken: string }) {
    return Table.create(input);
  },

  delete(tenantId: string | Types.ObjectId, tableId: string | Types.ObjectId) {
    return Table.findOneAndDelete({ _id: tableId, tenantId });
  },
};
