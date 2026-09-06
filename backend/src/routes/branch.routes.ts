import { Router } from "express";
import * as branchController from "../controllers/branch.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const branchRouter = Router();

// Branches are tenant-wide, managed by Tenant Admin only (§6A.5) — never branch-locked.
branchRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

branchRouter.get("/", branchController.listBranches);
branchRouter.post("/", branchController.createBranch);
branchRouter.get("/:id", branchController.getBranch);
branchRouter.put("/:id", branchController.updateBranch);
branchRouter.post("/:id/deactivate", branchController.deactivateBranch);
