import type { Request, Response } from "express";
import { adminOrderService } from "../services/adminOrder.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { listOrdersQuerySchema } from "../validators/adminOrder.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const filters = listOrdersQuerySchema.parse(req.query);
  const orders = await adminOrderService.list(tenantId, filters);
  sendSuccess(res, orders);
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await adminOrderService.getOne(tenantId, id);
  sendSuccess(res, order);
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await adminOrderService.cancel(tenantId, id, {
    actorId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
  sendSuccess(res, order);
});
