import { Router } from "express";
import * as posController from "../controllers/pos.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const posRouter = Router();

// Available to Waiter and Tenant Admin, scoped to their branch (§23A.2) — no new role.
posRouter.use(requireAuth, attachTenantContext, requireRole("WAITER", "TENANT_ADMIN"));

posRouter.get("/menu", posController.getPosMenu);
posRouter.get("/settings", posController.getPosSettings);
posRouter.post("/orders", posController.createPosOrder);
posRouter.post("/orders/:id/pay", posController.payPosOrder);
