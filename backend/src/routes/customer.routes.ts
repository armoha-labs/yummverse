import { Router } from "express";
import * as customerSessionController from "../controllers/customerSession.controller.js";
import * as customerOrderController from "../controllers/customerOrder.controller.js";
import { requireCustomerSession } from "../middleware/customerSession.middleware.js";

export const customerRouter = Router();

customerRouter.post("/session", customerSessionController.createSession);

customerRouter.post("/orders", requireCustomerSession, customerOrderController.createOrder);
customerRouter.get("/orders/:id", requireCustomerSession, customerOrderController.getOrder);
customerRouter.get("/orders/:id/status", requireCustomerSession, customerOrderController.getOrderStatus);
