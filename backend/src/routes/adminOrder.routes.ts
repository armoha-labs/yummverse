import { Router } from "express";
import * as adminOrderController from "../controllers/adminOrder.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const adminOrderRouter = Router();

adminOrderRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

adminOrderRouter.get("/", adminOrderController.listOrders);
adminOrderRouter.get("/:id", adminOrderController.getOrder);
adminOrderRouter.post("/:id/cancel", adminOrderController.cancelOrder);
