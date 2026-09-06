import { Router } from "express";
import * as reportController from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const reportRouter = Router();

reportRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

reportRouter.get("/revenue", reportController.getRevenueReport);
reportRouter.get("/tax", reportController.getTaxReport);
reportRouter.get("/item-performance", reportController.getItemPerformanceReport);
reportRouter.get("/orders", reportController.getOrdersReport);
reportRouter.get("/payments", reportController.getPaymentsReport);
reportRouter.post("/export", reportController.exportReport);
