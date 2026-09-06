import { categoryRepository } from "../repositories/category.repository.js";
import { menuItemRepository } from "../repositories/menuItem.repository.js";
import { branchMenuOverrideRepository } from "../repositories/branchMenuOverride.repository.js";
import type { Types } from "mongoose";

/** Resolves the customer-facing menu: master menu + any BranchMenuOverride applied on top (§6A.4). */
export const publicMenuService = {
  async getCategories(tenantId: string) {
    return categoryRepository.listForTenant(tenantId);
  },

  async getMenu(tenantId: string, branchId: string) {
    const [items, overrides] = await Promise.all([
      menuItemRepository.listForTenant(tenantId),
      branchMenuOverrideRepository.listForBranch(tenantId, branchId),
    ]);

    const overrideByItemId = new Map<string, boolean>(
      overrides.map((o) => [(o.menuItemId as Types.ObjectId).toString(), o.isAvailable]),
    );

    return items.map((item) => ({
      id: item._id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      price: item.price,
      taxPercentage: item.taxPercentage,
      isAvailable: overrideByItemId.get(item._id.toString()) ?? item.isAvailable,
    }));
  },
};
