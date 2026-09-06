import type { Request, Response } from "express";
import { paymentService } from "../services/payment.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { createPaymentSchema, verifyPaymentSchema, refundPaymentSchema } from "../validators/payment.validators.js";

function requireSession(req: Request) {
  if (!req.customerSession) throw ApiError.unauthorized("MISSING_SESSION");
  return req.customerSession;
}

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const session = requireSession(req);
  const { orderId } = createPaymentSchema.parse(req.body);
  const result = await paymentService.createPayment(
    { tenantId: session.tenantId, branchId: session.branchId, sessionId: session.sessionId },
    orderId,
  );
  sendSuccess(res, result, 201);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const session = requireSession(req);
  const input = verifyPaymentSchema.parse(req.body);
  const result = await paymentService.verifyPayment(
    { tenantId: session.tenantId, branchId: session.branchId, sessionId: session.sessionId },
    input,
  );
  sendSuccess(res, result);
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"];
  if (typeof signature !== "string") {
    throw ApiError.badRequest("MISSING_SIGNATURE", "Missing webhook signature header.");
  }
  const eventIdHeader = req.headers["x-razorpay-event-id"];
  const rawBody = (req.body as Buffer).toString("utf8");

  const result = await paymentService.processWebhook(
    rawBody,
    signature,
    typeof eventIdHeader === "string" ? eventIdHeader : undefined,
  );
  sendSuccess(res, result);
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const { amount } = refundPaymentSchema.parse(req.body ?? {});
  const payment = await paymentService.refund(
    tenantId,
    id,
    { actorId, ipAddress: req.ip, userAgent: req.headers["user-agent"] },
    amount,
  );
  sendSuccess(res, payment);
});
