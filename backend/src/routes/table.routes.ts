import { Router } from "express";
import * as tableController from "../controllers/table.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachTenantContext } from "../middleware/tenant.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";

export const tableRouter = Router();

tableRouter.use(requireAuth, attachTenantContext, requireRole("TENANT_ADMIN"));

// Registered before "/:id" so "qr" isn't swallowed as an id.
tableRouter.get("/qr/export", tableController.exportAllTablesQr);

tableRouter.get("/", tableController.listTables);
tableRouter.post("/", tableController.createTable);
tableRouter.get("/:id", tableController.getTable);
tableRouter.put("/:id", tableController.updateTable);
tableRouter.delete("/:id", tableController.deleteTable);
tableRouter.post("/:id/qr/regenerate", tableController.regenerateTableQr);
tableRouter.get("/:id/qr", tableController.getTableQrImage);
