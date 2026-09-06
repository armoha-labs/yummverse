import { Router } from "express";
import * as paymentSettingsController from "../controllers/paymentSettings.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const paymentSettingsRouter = Router();

paymentSettingsRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

paymentSettingsRouter.get("/", paymentSettingsController.getPaymentSettings);
paymentSettingsRouter.put("/", paymentSettingsController.upsertPaymentSettings);
paymentSettingsRouter.delete("/", paymentSettingsController.deletePaymentSettings);
paymentSettingsRouter.post("/test", paymentSettingsController.testPaymentConnection);
paymentSettingsRouter.post("/copy", paymentSettingsController.copyPaymentSettings);
