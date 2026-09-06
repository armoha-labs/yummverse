import { Router } from "express";
import * as platformController from "../controllers/platform.controller.js";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { loginRateLimiter } from "../middleware/rateLimit.middleware.js";

export const platformRouter = Router();

platformRouter.post("/auth/login", loginRateLimiter, authController.platformLogin);

platformRouter.use(requireAuth, requireRole("PLATFORM_ADMIN"));

platformRouter.post("/tenants", platformController.createTenant);
platformRouter.get("/tenants", platformController.listTenants);
platformRouter.get("/tenants/:id", platformController.getTenant);
platformRouter.post("/tenants/:id/resend-invite", platformController.resendAdminInvite);
platformRouter.post("/tenants/:id/activate", platformController.activateTenant);
platformRouter.post("/tenants/:id/suspend", platformController.suspendTenant);
platformRouter.post("/tenants/:id/cancel", platformController.cancelTenant);
platformRouter.put("/tenants/:id/subscription", platformController.updateSubscription);
platformRouter.get("/tenants/:id/limits", platformController.getLimits);
platformRouter.put("/tenants/:id/limits", platformController.updateLimits);
platformRouter.get("/tenants/:id/invoices", platformController.listInvoices);
platformRouter.post("/tenants/:id/invoices", platformController.generateInvoice);
platformRouter.post("/tenants/:id/invoices/:invoiceId/send", platformController.sendInvoice);
platformRouter.post("/tenants/:id/invoices/:invoiceId/mark-paid", platformController.markInvoicePaid);
platformRouter.get("/tenants/:id/invoices/:invoiceId/pdf", platformController.downloadInvoicePdf);
platformRouter.get("/reports/summary", platformController.getPlatformMetrics);
