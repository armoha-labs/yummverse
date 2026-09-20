import { categoryRepository } from "../repositories/category.repository.js";
import { menuItemRepository } from "../repositories/menuItem.repository.js";

/** Resolves the customer-facing menu. */
export const publicMenuService = {
  async getCategories(tenantId: string) {
    return categoryRepository.listForTenant(tenantId);
  },

  async getMenu(tenantId: string, _branchId: string) {
    const items = await menuItemRepository.listForTenant(tenantId);

    return items.map((item) => ({
      id: item._id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      price: item.price,
      taxPercentage: item.taxPercentage,
      isAvailable: item.isAvailable,
    }));
  },
};
