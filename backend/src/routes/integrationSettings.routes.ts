import { Router } from "express";
import * as integrationSettingsController from "../controllers/integrationSettings.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const integrationSettingsRouter = Router();

integrationSettingsRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

integrationSettingsRouter.get("/", integrationSettingsController.listIntegrationSettings);
integrationSettingsRouter.put("/:provider", integrationSettingsController.upsertIntegrationSettings);
