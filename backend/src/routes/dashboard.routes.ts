import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  requireAuth,
  attachTenantContext,
  requireRole("TENANT_ADMIN"),
  dashboardController.getDashboard,
);
