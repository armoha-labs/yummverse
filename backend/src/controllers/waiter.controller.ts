import type { Request, Response } from "express";
import { orderLifecycleService } from "../services/orderLifecycle.service.js";
import { tableRepository } from "../repositories/table.repository.js";
import { resolveKitchenEnabled, resolveTableStatusEnabled } from "../services/orderCalculation.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";

function requireBranchContext(req: Request): { tenantId: string; branchId: string } {
  if (!req.tenantId || !req.branchId) throw ApiError.forbidden("BRANCH_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, branchId: req.branchId };
}

export const listWaiterTables = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireBranchContext(req);
  const tables = await tableRepository.listForTenant(tenantId, branchId);
  sendSuccess(res, tables);
});

export const listWaiterOrders = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireBranchContext(req);
  const orders = await orderLifecycleService.listActiveForBranch(tenantId, branchId);
  sendSuccess(res, orders);
});

export const getWaiterOrder = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireBranchContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.getOne(tenantId, branchId, id);
  sendSuccess(res, order);
});

export const markServed = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireBranchContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.served(tenantId, branchId, id);
  sendSuccess(res, order);
});

/** Lets the Waiter app adapt to this branch's kitchen/table-status workflow — a Waiter is
 * always locked to one branch (§6A.5), so this needs no branchId param, unlike the Tenant
 * Admin's /tenant/settings (tenant-wide) which isn't branch-aware. */
export const getWaiterSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireBranchContext(req);
  const [kitchenEnabled, tableStatusEnabled] = await Promise.all([
    resolveKitchenEnabled(tenantId, branchId),
    resolveTableStatusEnabled(tenantId, branchId),
  ]);
  sendSuccess(res, { kitchenEnabled, tableStatusEnabled });
});
