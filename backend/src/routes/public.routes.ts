import { Router } from "express";
import * as publicController from "../controllers/public.controller.js";
import { requireCustomerSession } from "../middleware/customerSession.middleware.js";

export const publicRouter = Router();

publicRouter.get("/tables/:qrToken", publicController.getTableByQrToken);
publicRouter.get("/tenant/branding", publicController.getTenantBranding);
publicRouter.get("/categories", requireCustomerSession, publicController.getPublicCategories);
publicRouter.get("/menu", requireCustomerSession, publicController.getPublicMenu);
