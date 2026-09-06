import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import { requireCustomerSession } from "../middleware/customerSession.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const paymentRouter = Router();

paymentRouter.post("/create", requireCustomerSession, paymentController.createPayment);
paymentRouter.post("/verify", requireCustomerSession, paymentController.verifyPayment);

// No auth — this is called by the payment gateway itself; the signature check inside
// paymentService.processWebhook is the security boundary (§37).
paymentRouter.post("/webhook", paymentController.handleWebhook);

paymentRouter.post(
  "/:id/refund",
  requireAuth,
  attachTenantContext,
  requireRole("TENANT_ADMIN"),
  paymentController.refundPayment,
);
