import { menuItemRepository } from "../repositories/menuItem.repository.js";
import { categoryRepository } from "../repositories/category.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";
import { getLocalDiskStorage, type UploadedFile } from "../storage/index.js";
import { logger } from "../config/logger.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

async function assertCategoryBelongsToTenant(tenantId: string, categoryId: string) {
  const category = await categoryRepository.findById(tenantId, categoryId);
  if (!category) throw ApiError.notFound("CATEGORY_NOT_FOUND", "Category not found.");
}

export const menuItemService = {
  listForTenant(tenantId: string, filters?: { categoryId?: string; includeInactive?: boolean }) {
    return menuItemRepository.listForTenant(tenantId, filters);
  },

  async create(
    tenantId: string,
    input: { categoryId: string; name: string; description?: string; price: number; taxPercentage?: number },
    actor: Actor,
  ) {
    await assertCategoryBelongsToTenant(tenantId, input.categoryId);

    const item = await menuItemRepository.create({ ...input, tenantId });

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_CREATED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return item;
  },

  async update(
    tenantId: string,
    menuItemId: string,
    updates: {
      name?: string;
      description?: string;
      imageUrl?: string;
      categoryId?: string;
      price?: number;
      taxPercentage?: number;
      active?: boolean;
    },
    actor: Actor,
  ) {
    const item = await menuItemRepository.findById(tenantId, menuItemId);
    if (!item) throw ApiError.notFound("MENU_ITEM_NOT_FOUND", "Menu item not found.");

    if (updates.categoryId !== undefined) {
      await assertCategoryBelongsToTenant(tenantId, updates.categoryId);
      item.categoryId = updates.categoryId as never;
    }
    const priceChanged = updates.price !== undefined && updates.price !== item.price;

    if (updates.name !== undefined) item.name = updates.name;
    if (updates.description !== undefined) item.description = updates.description;
    if (updates.imageUrl !== undefined) item.imageUrl = updates.imageUrl;
    if (updates.price !== undefined) item.price = updates.price;
    if (updates.taxPercentage !== undefined) item.taxPercentage = updates.taxPercentage;
    if (updates.active !== undefined) item.active = updates.active;
    await item.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_UPDATED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    if (priceChanged) {
      await auditService.record({
        tenantId,
        actorType: "USER",
        actorId: actor.actorId,
        action: "PRICE_CHANGED",
        entityType: "MenuItem",
        entityId: item._id,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }

    return item;
  },

  async setAvailability(tenantId: string, menuItemId: string, isAvailable: boolean, actor: Actor) {
    const item = await menuItemRepository.findById(tenantId, menuItemId);
    if (!item) throw ApiError.notFound("MENU_ITEM_NOT_FOUND", "Menu item not found.");

    item.isAvailable = isAvailable;
    await item.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_AVAILABILITY_CHANGED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    realtimeEvents.menuAvailabilityChanged(tenantId, item);

    return item;
  },

  async uploadImage(tenantId: string, menuItemId: string, file: UploadedFile, actor: Actor) {
    const item = await menuItemRepository.findById(tenantId, menuItemId);
    if (!item) throw ApiError.notFound("MENU_ITEM_NOT_FOUND", "Menu item not found.");

    const previousAssetId = item.imageAssetId;

    // Primary: base64 straight into the document, same pattern as the tenant logo — works
    // identically to a URL, no external dependency, survives Render's ephemeral filesystem.
    item.imageUrl = `data:${file.mimeType};base64,${file.buffer.toString("base64")}`;

    // Secondary: best-effort local-disk backup copy — losing this doesn't lose the image,
    // the base64 copy above is authoritative.
    try {
      const backup = await getLocalDiskStorage().upload(`menu-items/${tenantId}/${menuItemId}`, file);
      item.imageAssetId = backup.assetId;
    } catch (err) {
      logger.warn({ err, tenantId, menuItemId }, "Failed to write local-disk backup copy of uploaded menu item image");
      item.imageAssetId = undefined;
    }

    await item.save();

    if (previousAssetId) {
      await getLocalDiskStorage()
        .delete(previousAssetId)
        .catch((err: unknown) => {
          logger.warn({ err, previousAssetId }, "Failed to delete replaced menu item image backup");
        });
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_UPDATED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return item;
  },

  async removeImage(tenantId: string, menuItemId: string, actor: Actor) {
    const item = await menuItemRepository.findById(tenantId, menuItemId);
    if (!item) throw ApiError.notFound("MENU_ITEM_NOT_FOUND", "Menu item not found.");

    const assetId = item.imageAssetId;
    item.imageUrl = undefined;
    item.imageAssetId = undefined;
    await item.save();

    if (assetId) {
      await getLocalDiskStorage()
        .delete(assetId)
        .catch((err: unknown) => {
          logger.warn({ err, assetId }, "Failed to delete removed menu item image backup");
        });
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_UPDATED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return item;
  },

  async delete(tenantId: string, menuItemId: string, actor: Actor) {
    const item = await menuItemRepository.findById(tenantId, menuItemId);
    if (!item) throw ApiError.notFound("MENU_ITEM_NOT_FOUND", "Menu item not found.");

    await menuItemRepository.delete(tenantId, menuItemId);

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "MENU_ITEM_UPDATED",
      entityType: "MenuItem",
      entityId: item._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  },

  reorder(tenantId: string, orderedIds: string[]) {
    return menuItemRepository.reorder(tenantId, orderedIds);
  },
};
