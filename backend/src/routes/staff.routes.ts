import { Router } from "express";
import * as staffController from "../controllers/staff.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const staffRouter = Router();

staffRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

staffRouter.get("/", staffController.listStaff);
staffRouter.post("/", staffController.createStaff);
staffRouter.get("/:id", staffController.getStaffMember);
staffRouter.put("/:id", staffController.updateStaff);
staffRouter.post("/:id/deactivate", staffController.deactivateStaff);
staffRouter.post("/:id/activate", staffController.activateStaff);
staffRouter.post("/:id/reset-password", staffController.resetStaffPassword);
