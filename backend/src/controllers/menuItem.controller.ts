import type { Request, Response } from "express";
import { menuItemService } from "../services/menuItem.service.js";
import { menuBulkService } from "../services/menuBulk.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { toCsv, toExcel, parseCsv, parseExcel } from "../utils/exportFormats.js";
import { idParamSchema } from "../validators/common.validators.js";
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  setAvailabilitySchema,
  reorderSchema,
  listMenuItemsQuerySchema,
  branchIdParamSchema,
  menuExportQuerySchema,
} from "../validators/menu.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { categoryId } = listMenuItemsQuerySchema.parse(req.query);
  const items = await menuItemService.listForTenant(tenantId, { categoryId, includeInactive: true });
  sendSuccess(res, items);
});

export const createMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = createMenuItemSchema.parse(req.body);
  const item = await menuItemService.create(tenantId, input, { actorId, ...actorMeta(req) });
  sendSuccess(res, item, 201);
});

export const updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const updates = updateMenuItemSchema.parse(req.body);
  const item = await menuItemService.update(tenantId, id, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, item);
});

export const deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  await menuItemService.delete(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, { message: "Menu item deleted." });
});

export const setMenuItemAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const { isAvailable } = setAvailabilitySchema.parse(req.body);
  const item = await menuItemService.setAvailability(tenantId, id, isAvailable, {
    actorId,
    ...actorMeta(req),
  });
  sendSuccess(res, item);
});

export const reorderMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { orderedIds } = reorderSchema.parse(req.body);
  await menuItemService.reorder(tenantId, orderedIds);
  sendSuccess(res, { message: "Reordered." });
});

export const getBranchOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const overrides = await menuItemService.getBranchOverrides(tenantId, id);
  sendSuccess(res, overrides);
});

export const setBranchOverride = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const { branchId } = branchIdParamSchema.parse(req.params);
  const { isAvailable } = setAvailabilitySchema.parse(req.body);
  const override = await menuItemService.setBranchOverride(tenantId, id, branchId, isAvailable);
  sendSuccess(res, override);
});

export const exportMenu = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { format } = menuExportQuerySchema.parse(req.query);
  const rows = await menuBulkService.exportMenu(tenantId);

  const buffer = format === "excel" ? await toExcel(rows, "Menu") : await toCsv(rows);
  const contentType =
    format === "excel"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";
  const filename = `menu.${format === "excel" ? "xlsx" : "csv"}`;

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

export const importMenu = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  if (!req.file) throw ApiError.badRequest("FILE_REQUIRED", "Choose a CSV or Excel file to import.");

  const isExcel = req.file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const rows = isExcel ? await parseExcel(req.file.buffer) : await parseCsv(req.file.buffer);

  const summary = await menuBulkService.importMenu(tenantId, rows, { actorId, ...actorMeta(req) });
  sendSuccess(res, summary);
});
