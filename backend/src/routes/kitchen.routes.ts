import { Router } from "express";
import * as kitchenController from "../controllers/kitchen.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const kitchenRouter = Router();

kitchenRouter.use(requireAuth, attachTenantContext, requireRole("KITCHEN"));

kitchenRouter.get("/orders", kitchenController.listKitchenOrders);
kitchenRouter.post("/orders/:id/accept", kitchenController.acceptOrder);
kitchenRouter.post("/orders/:id/preparing", kitchenController.startPreparing);
kitchenRouter.post("/orders/:id/ready", kitchenController.markReady);
