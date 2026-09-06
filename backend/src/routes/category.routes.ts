import { Router } from "express";
import * as categoryController from "../controllers/category.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const categoryRouter = Router();

categoryRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

// Registered before "/:id" so "reorder" isn't swallowed as an id.
categoryRouter.put("/reorder", categoryController.reorderCategories);

categoryRouter.get("/", categoryController.listCategories);
categoryRouter.post("/", categoryController.createCategory);
categoryRouter.put("/:id", categoryController.updateCategory);
categoryRouter.delete("/:id", categoryController.deleteCategory);
