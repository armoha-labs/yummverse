import type { Request, Response } from "express";
import { posService } from "../services/pos.service.js";
import { publicMenuService } from "../services/publicMenu.service.js";
import { resolveActingBranchId } from "../services/resolveActingBranch.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { createPosOrderSchema, posPaySchema } from "../validators/pos.validators.js";
import { branchIdQuerySchema } from "../validators/table.validators.js";

// Waiter's branch is fixed by their token; Tenant Admin (not branch-locked, §23A.2) must
// say which branch — resolved automatically when the tenant has only one.
async function resolveBranch(req: Request, bodyBranchId?: string): Promise<string> {
  if (!req.tenantId) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return req.branchId ?? resolveActingBranchId(req.tenantId, bodyBranchId);
}

export const createPosOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  const input = createPosOrderSchema.parse(req.body);
  const branchId = await resolveBranch(req, input.branchId);

  const order = await posService.createOrder(
    { tenantId: req.tenantId, branchId, userId: req.auth.sub },
    { items: input.items, tableId: input.tableId },
  );
  sendSuccess(res, order, 201);
});

export const payPosOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  const { id } = idParamSchema.parse(req.params);
  const { method } = posPaySchema.parse(req.body);

  // Waiter's branchId comes from their token; Tenant Admin isn't branch-locked, so the
  // order's own branch (verified inside posService.pay) is authoritative here.
  const result = await posService.pay(
    { tenantId: req.tenantId, branchId: req.branchId, userId: req.auth.sub },
    id,
    method,
  );
  sendSuccess(res, result);
});

export const getPosMenu = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenantId) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  const { branchId: queryBranchId } = branchIdQuerySchema.parse(req.query);
  const branchId = await resolveBranch(req, queryBranchId);
  const items = await publicMenuService.getMenu(req.tenantId, branchId);
  sendSuccess(res, items);
});
