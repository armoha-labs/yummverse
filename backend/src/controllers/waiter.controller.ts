import type { Request, Response } from "express";
import { orderLifecycleService } from "../services/orderLifecycle.service.js";
import { tableRepository } from "../repositories/table.repository.js";
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
