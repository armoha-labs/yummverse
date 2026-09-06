import { MenuItem } from "../models/MenuItem.js";
import { Types } from "mongoose";

export const menuItemRepository = {
  listForTenant(
    tenantId: string | Types.ObjectId,
    filters: { categoryId?: string; includeInactive?: boolean } = {},
  ) {
    return MenuItem.find({
      tenantId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.includeInactive ? {} : { active: true }),
    }).sort({ displayOrder: 1 });
  },

  findById(tenantId: string | Types.ObjectId, menuItemId: string | Types.ObjectId) {
    return MenuItem.findOne({ _id: menuItemId, tenantId });
  },

  countForCategory(tenantId: string | Types.ObjectId, categoryId: string | Types.ObjectId) {
    return MenuItem.countDocuments({ tenantId, categoryId, active: true });
  },

  create(input: {
    tenantId: string | Types.ObjectId;
    categoryId: string | Types.ObjectId;
    name: string;
    description?: string;
    price: number;
    taxPercentage?: number;
    displayOrder?: number;
  }) {
    return MenuItem.create(input);
  },

  delete(tenantId: string | Types.ObjectId, menuItemId: string | Types.ObjectId) {
    return MenuItem.findOneAndDelete({ _id: menuItemId, tenantId });
  },

  deactivateForCategory(tenantId: string | Types.ObjectId, categoryId: string | Types.ObjectId) {
    return MenuItem.updateMany({ tenantId, categoryId }, { active: false });
  },

  async reorder(tenantId: string | Types.ObjectId, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) => MenuItem.updateOne({ _id: id, tenantId }, { displayOrder: index })),
    );
  },
};
