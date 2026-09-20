import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { authRouter } from "./auth.routes.js";
import { platformRouter } from "./platform.routes.js";
import { tenantRouter } from "./tenant.routes.js";
import { paymentSettingsRouter } from "./paymentSettings.routes.js";
import { integrationSettingsRouter } from "./integrationSettings.routes.js";
import { tableRouter } from "./table.routes.js";
import { publicRouter } from "./public.routes.js";
import { customerRouter } from "./customer.routes.js";
import { categoryRouter } from "./category.routes.js";
import { menuItemRouter } from "./menuItem.routes.js";
import { paymentRouter } from "./payment.routes.js";
import { kitchenRouter } from "./kitchen.routes.js";
import { waiterRouter } from "./waiter.routes.js";
import { adminKitchenRouter } from "./adminKitchen.routes.js";
import { staffRouter } from "./staff.routes.js";
import { posRouter } from "./pos.routes.js";
import { adminOrderRouter } from "./adminOrder.routes.js";
import { reportRouter } from "./report.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { notificationRouter } from "./notification.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.use("/auth", authRouter);
apiRouter.use("/platform", platformRouter);
// Registered before the general /tenant prefix below, so it's matched first rather than
// relying on Express falling through tenantRouter when no internal route matches.
apiRouter.use("/tenant/payment-settings", paymentSettingsRouter);
apiRouter.use("/tenant/integrations", integrationSettingsRouter);
apiRouter.use("/tenant/reports", reportRouter);
apiRouter.use("/tenant", tenantRouter);
apiRouter.use("/admin/tables", tableRouter);
apiRouter.use("/admin/categories", categoryRouter);
apiRouter.use("/admin/menu-items", menuItemRouter);
apiRouter.use("/admin/orders", adminOrderRouter);
apiRouter.use("/admin/dashboard", dashboardRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/customer", customerRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/kitchen", kitchenRouter);
apiRouter.use("/waiter", waiterRouter);
apiRouter.use("/admin/kitchen", adminKitchenRouter);
apiRouter.use("/admin/users", staffRouter);
apiRouter.use("/pos", posRouter);
apiRouter.use("/notifications", notificationRouter);
