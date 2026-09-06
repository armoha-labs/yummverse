import { Category } from "../models/Category.js";
import { Types } from "mongoose";

export const categoryRepository = {
  listForTenant(tenantId: string | Types.ObjectId, includeInactive = false) {
    return Category.find({ tenantId, ...(includeInactive ? {} : { active: true }) }).sort({
      displayOrder: 1,
    });
  },

  findById(tenantId: string | Types.ObjectId, categoryId: string | Types.ObjectId) {
    return Category.findOne({ _id: categoryId, tenantId });
  },

  create(input: { tenantId: string | Types.ObjectId; name: string; description?: string; displayOrder?: number }) {
    return Category.create(input);
  },

  delete(tenantId: string | Types.ObjectId, categoryId: string | Types.ObjectId) {
    return Category.findOneAndDelete({ _id: categoryId, tenantId });
  },

  async reorder(tenantId: string | Types.ObjectId, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) => Category.updateOne({ _id: id, tenantId }, { displayOrder: index })),
    );
  },
};
