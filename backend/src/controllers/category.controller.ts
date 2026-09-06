import type { Request, Response } from "express";
import { categoryService } from "../services/category.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { createCategorySchema, updateCategorySchema, reorderSchema } from "../validators/menu.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const categories = await categoryService.listForTenant(tenantId, true);
  sendSuccess(res, categories);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = createCategorySchema.parse(req.body);
  const category = await categoryService.create(tenantId, input, { actorId, ...actorMeta(req) });
  sendSuccess(res, category, 201);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const updates = updateCategorySchema.parse(req.body);
  const category = await categoryService.update(tenantId, id, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  await categoryService.delete(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, { message: "Category deleted; its items were deactivated." });
});

export const reorderCategories = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { orderedIds } = reorderSchema.parse(req.body);
  await categoryService.reorder(tenantId, orderedIds);
  sendSuccess(res, { message: "Reordered." });
});
