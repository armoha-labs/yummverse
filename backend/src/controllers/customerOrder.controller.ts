import type { Request, Response } from "express";
import { orderService } from "../services/order.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { createOrderSchema } from "../validators/order.validators.js";

function requireSession(req: Request) {
  if (!req.customerSession) throw ApiError.unauthorized("MISSING_SESSION");
  return req.customerSession;
}

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const session = requireSession(req);
  const input = createOrderSchema.parse(req.body);
  const order = await orderService.createFromCustomerSession(session, input);
  sendSuccess(res, order, 201);
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const session = requireSession(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderService.getForSession(session, id);
  sendSuccess(res, order);
});

export const getOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const session = requireSession(req);
  const { id } = idParamSchema.parse(req.params);
  const order = await orderService.getForSession(session, id);
  sendSuccess(res, {
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
  });
});
