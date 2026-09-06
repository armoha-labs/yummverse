import { categoryRepository } from "../repositories/category.repository.js";
import { menuItemRepository } from "../repositories/menuItem.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export const categoryService = {
  listForTenant(tenantId: string, includeInactive?: boolean) {
    return categoryRepository.listForTenant(tenantId, includeInactive);
  },

  async create(tenantId: string, input: { name: string; description?: string }, actor: Actor) {
    const category = await categoryRepository.create({ ...input, tenantId });

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: category._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return category;
  },

  async update(
    tenantId: string,
    categoryId: string,
    updates: { name?: string; description?: string; imageUrl?: string; active?: boolean },
    actor: Actor,
  ) {
    const category = await categoryRepository.findById(tenantId, categoryId);
    if (!category) throw ApiError.notFound("CATEGORY_NOT_FOUND", "Category not found.");

    if (updates.name !== undefined) category.name = updates.name;
    if (updates.description !== undefined) category.description = updates.description;
    if (updates.imageUrl !== undefined) category.imageUrl = updates.imageUrl;
    if (updates.active !== undefined) category.active = updates.active;
    await category.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: category._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return category;
  },

  /** Deleting a category with active items cascade-deactivates them (§29A.2's explicit choice)
   * rather than blocking or leaving orphaned categoryId references. */
  async delete(tenantId: string, categoryId: string, actor: Actor) {
    const category = await categoryRepository.findById(tenantId, categoryId);
    if (!category) throw ApiError.notFound("CATEGORY_NOT_FOUND", "Category not found.");

    await menuItemRepository.deactivateForCategory(tenantId, categoryId);
    await categoryRepository.delete(tenantId, categoryId);

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: category._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  },

  reorder(tenantId: string, orderedIds: string[]) {
    return categoryRepository.reorder(tenantId, orderedIds);
  },
};
