import { Router } from "express";
import * as waiterController from "../controllers/waiter.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const waiterRouter = Router();

waiterRouter.use(requireAuth, attachTenantContext, requireRole("WAITER"));

waiterRouter.get("/tables", waiterController.listWaiterTables);
waiterRouter.get("/orders", waiterController.listWaiterOrders);
waiterRouter.get("/orders/:id", waiterController.getWaiterOrder);
waiterRouter.post("/orders/:id/served", waiterController.markServed);
