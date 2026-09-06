import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";

export const notificationRouter = Router();

notificationRouter.post("/register-token", notificationController.registerToken);
notificationRouter.delete("/register-token", notificationController.deregisterToken);
