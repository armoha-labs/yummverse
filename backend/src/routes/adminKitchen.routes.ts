import { Router } from "express";
import * as adminKitchenController from "../controllers/adminKitchen.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const adminKitchenRouter = Router();

adminKitchenRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

adminKitchenRouter.get("/orders", adminKitchenController.listAdminKitchenOrders);
adminKitchenRouter.post("/orders/:id/accept", adminKitchenController.adminAcceptOrder);
adminKitchenRouter.post("/orders/:id/preparing", adminKitchenController.adminStartPreparing);
adminKitchenRouter.post("/orders/:id/ready", adminKitchenController.adminMarkReady);
