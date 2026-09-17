import { categoryRepository } from "../repositories/category.repository.js";
import { menuItemRepository } from "../repositories/menuItem.repository.js";
import { categoryService } from "./category.service.js";
import { menuItemService } from "./menuItem.service.js";
import type { AuditContext } from "./audit.service.js";
import type { ExportRow, ImportRow } from "../utils/exportFormats.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

/** Column headers, shared by export and import so a file round-trips without remapping. */
const COL = {
  category: "Category",
  itemName: "Item Name",
  description: "Description",
  price: "Price",
  gst: "GST %",
  available: "Available",
} as const;

export interface MenuImportSummary {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: { row: number; message: string }[];
}

function cell(row: ImportRow, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

export const menuBulkService = {
  /** One flattened sheet — Category + item columns — rather than two separate
   * categories/items files, so an admin can edit their whole menu in one spreadsheet. An
   * empty category (no items yet) still gets a row with blank item columns, so it round-trips
   * through export → edit → import without being silently dropped. */
  async exportMenu(tenantId: string): Promise<ExportRow[]> {
    const [categories, items] = await Promise.all([
      categoryRepository.listForTenant(tenantId, true),
      menuItemRepository.listForTenant(tenantId, { includeInactive: true }),
    ]);

    const rows: ExportRow[] = [];
    for (const cat of categories) {
      const catItems = items
        .filter((item) => item.categoryId.toString() === cat._id.toString())
        .sort((a, b) => a.displayOrder - b.displayOrder);

      if (catItems.length === 0) {
        rows.push({
          [COL.category]: cat.name,
          [COL.itemName]: "",
          [COL.description]: "",
          [COL.price]: "",
          [COL.gst]: "",
          [COL.available]: "",
        });
        continue;
      }

      for (const item of catItems) {
        rows.push({
          [COL.category]: cat.name,
          [COL.itemName]: item.name,
          [COL.description]: item.description ?? "",
          [COL.price]: item.price,
          [COL.gst]: item.taxPercentage,
          [COL.available]: item.isAvailable ? "Yes" : "No",
        });
      }
    }
    return rows;
  },

  /** Upserts by (category name, item name) — case-insensitive, matching how a café admin
   * would naturally re-import an edited export. Unknown categories are created; a row that
   * names an existing category/item combination updates it in place rather than duplicating
   * it. Processes every row rather than failing the whole file on the first bad one — errors
   * are collected per row so the admin can fix just those and re-import. */
  async importMenu(tenantId: string, rows: ImportRow[], actor: Actor): Promise<MenuImportSummary> {
    const summary: MenuImportSummary = { categoriesCreated: 0, itemsCreated: 0, itemsUpdated: 0, errors: [] };

    const existingCategories = await categoryRepository.listForTenant(tenantId, true);
    const categoryByName = new Map(existingCategories.map((c) => [c.name.trim().toLowerCase(), c]));

    const existingItems = await menuItemRepository.listForTenant(tenantId, { includeInactive: true });
    const itemByKey = new Map(
      existingItems.map((item) => [`${item.categoryId.toString()}:${item.name.trim().toLowerCase()}`, item]),
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowNumber = i + 2; // header is row 1

      const categoryName = cell(row, COL.category);
      const itemName = cell(row, COL.itemName);

      if (!categoryName) {
        // A fully blank row (common trailing spreadsheet rows) is silently skipped; a row
        // with an item name but no category is a real mistake worth flagging.
        if (itemName) summary.errors.push({ row: rowNumber, message: "Missing Category." });
        continue;
      }

      let category = categoryByName.get(categoryName.toLowerCase());
      if (!category) {
        category = await categoryService.create(tenantId, { name: categoryName }, actor);
        categoryByName.set(categoryName.toLowerCase(), category);
        summary.categoriesCreated++;
      }

      // A row that only declares a category (blank item columns) — how an empty category is
      // represented in the export — needs nothing further.
      if (!itemName) continue;

      const priceRaw = cell(row, COL.price);
      const price = Number(priceRaw);
      if (!priceRaw || !Number.isFinite(price) || price < 0) {
        summary.errors.push({ row: rowNumber, message: `Invalid Price for "${itemName}".` });
        continue;
      }

      const gstRaw = cell(row, COL.gst);
      const gst = gstRaw === "" ? 0 : Number(gstRaw);
      if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
        summary.errors.push({ row: rowNumber, message: `Invalid GST % for "${itemName}".` });
        continue;
      }

      const description = cell(row, COL.description) || undefined;
      const availableRaw = cell(row, COL.available).toLowerCase();
      const isAvailable = availableRaw === "" ? true : ["yes", "true", "1"].includes(availableRaw);

      const key = `${category._id.toString()}:${itemName.toLowerCase()}`;
      const existing = itemByKey.get(key);

      if (existing) {
        await menuItemService.update(
          tenantId,
          existing._id.toString(),
          { price, taxPercentage: gst, description, active: true },
          actor,
        );
        if (existing.isAvailable !== isAvailable) {
          await menuItemService.setAvailability(tenantId, existing._id.toString(), isAvailable, actor);
        }
        summary.itemsUpdated++;
      } else {
        const created = await menuItemService.create(
          tenantId,
          { categoryId: category._id.toString(), name: itemName, description, price, taxPercentage: gst },
          actor,
        );
        if (!isAvailable) {
          await menuItemService.setAvailability(tenantId, created._id.toString(), false, actor);
        }
        itemByKey.set(key, created);
        summary.itemsCreated++;
      }
    }

    return summary;
  },
};
