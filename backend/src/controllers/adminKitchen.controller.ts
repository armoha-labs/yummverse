import type { Request, Response } from "express";
import { orderLifecycleService } from "../services/orderLifecycle.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { branchIdQuerySchema } from "../validators/table.validators.js";

function requireTenantContext(req: Request): string {
  if (!req.tenantId) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return req.tenantId;
}

// Tenant Admin reads the same kitchen queue read-only, and may take the same actions
// (Principle 8) — never branch-locked, so branchId is an optional query filter (§6A.5, §36).
export const listAdminKitchenOrders = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  const orders = await orderLifecycleService.listActiveForTenant(tenantId, branchId);
  sendSuccess(res, orders);
});

export const adminAcceptOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.accept(tenantId, undefined, id);
  sendSuccess(res, order);
});

export const adminStartPreparing = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.preparing(tenantId, undefined, id);
  sendSuccess(res, order);
});

export const adminMarkReady = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderLifecycleService.ready(tenantId, undefined, id);
  sendSuccess(res, order);
});
