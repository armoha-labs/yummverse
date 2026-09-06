import { Router } from "express";
import * as tenantController from "../controllers/tenant.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { imageUpload } from "../middleware/upload.middleware.js";

export const tenantRouter = Router();

tenantRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

tenantRouter.get("/profile", tenantController.getProfile);
tenantRouter.put("/profile", tenantController.updateProfile);

tenantRouter.get("/settings", tenantController.getSettings);
tenantRouter.put("/settings", tenantController.updateSettings);

tenantRouter.get("/branding", tenantController.getBranding);
tenantRouter.put("/branding", tenantController.updateBranding);
tenantRouter.post("/branding/logo", imageUpload.single("file"), tenantController.uploadLogo);
tenantRouter.delete("/branding/logo", tenantController.deleteLogo);
