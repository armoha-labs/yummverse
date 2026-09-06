import type { Request, Response } from "express";
import { orderLifecycleService } from "../services/orderLifecycle.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";

function requireKitchenContext(req: Request): { tenantId: string; branchId: string } {
  if (!req.tenantId || !req.branchId) throw ApiError.forbidden("BRANCH_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, branchId: req.branchId };
}

export const listKitchenOrders = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireKitchenContext(req);
  const orders = await orderLifecycleService.listActiveForBranch(tenantId, branchId);
  sendSuccess(res, orders);
});

export const acceptOrder = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireKitchenContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.accept(tenantId, branchId, id);
  sendSuccess(res, order);
});

export const startPreparing = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireKitchenContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.preparing(tenantId, branchId, id);
  sendSuccess(res, order);
});

export const markReady = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, branchId } = requireKitchenContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.ready(tenantId, branchId, id);
  sendSuccess(res, order);
});
