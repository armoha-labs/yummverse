import { Router } from "express";
import * as menuItemController from "../controllers/menuItem.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { spreadsheetUpload, imageUpload } from "../middleware/upload.middleware.js";

export const menuItemRouter = Router();

menuItemRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

// Registered before "/:id" so these static segments aren't swallowed as an id.
menuItemRouter.put("/reorder", menuItemController.reorderMenuItems);
menuItemRouter.get("/export", menuItemController.exportMenu);
menuItemRouter.post("/import", spreadsheetUpload.single("file"), menuItemController.importMenu);

menuItemRouter.get("/", menuItemController.listMenuItems);
menuItemRouter.post("/", menuItemController.createMenuItem);
menuItemRouter.put("/:id", menuItemController.updateMenuItem);
menuItemRouter.delete("/:id", menuItemController.deleteMenuItem);
menuItemRouter.post("/:id/image", imageUpload.single("file"), menuItemController.uploadMenuItemImage);
menuItemRouter.delete("/:id/image", menuItemController.deleteMenuItemImage);
menuItemRouter.patch("/:id/availability", menuItemController.setMenuItemAvailability);
menuItemRouter.get("/:id/branch-overrides", menuItemController.getBranchOverrides);
menuItemRouter.put("/:id/branch-overrides/:branchId", menuItemController.setBranchOverride);
