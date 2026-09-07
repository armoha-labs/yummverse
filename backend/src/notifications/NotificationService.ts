import { deviceTokenRepository } from "../repositories/deviceToken.repository.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { tenantLimitsService } from "../services/tenantLimits.service.js";
import type { DeviceStaffRole } from "../models/DeviceToken.js";

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

interface OrderLike {
  _id: unknown;
  tenantId: unknown;
  branchId: unknown;
  orderNumber: number;
  totalAmount?: number;
  tableId?: unknown;
  customer?: { sessionId?: unknown } | null;
}

let messagingApp: import("firebase-admin").app.App | undefined;

async function getMessaging() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return null; // not configured — caller logs instead (§54's optional pair)
  }
  if (!messagingApp) {
    const admin = await import("firebase-admin");
    messagingApp = admin.apps[0] ?? admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)),
      projectId: env.FIREBASE_PROJECT_ID,
    });
  }
  const admin = await import("firebase-admin");
  return admin.messaging(messagingApp);
}

/** §40A.4's send flow: resolve recipients (tenant/branch-scoped), build the payload, send via
 * FCM. Socket.IO delivery for foreground clients happens separately (sockets/realtimeEvents.ts)
 * — this is the backgrounded/closed-app channel, sent in parallel, never as the sole path. */
async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = await getMessaging();
  if (!messaging) {
    logger.info({ tokenCount: tokens.length, payload }, "Push notification (FCM not configured — logging only)");
    return;
  }

  const result = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
  });

  await Promise.all(
    result.responses.map((r, i) => {
      if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
        return deviceTokenRepository.removeInvalid(tokens[i]!);
      }
      return Promise.resolve();
    }),
  );
}

async function pushEnabled(tenantId: string): Promise<boolean> {
  const limits = await tenantLimitsService.resolveEffectiveLimits(tenantId);
  return limits.firebasePushEnabled;
}

/** Kitchen/Waiter — branch-locked, and role-scoped so each only gets what's meant for it
 * (previously both received every branch USER token's notifications indiscriminately). */
async function tokensForBranchRole(tenantId: string, branchId: string, role: DeviceStaffRole): Promise<string[]> {
  if (!(await pushEnabled(tenantId))) return [];
  const devices = await deviceTokenRepository.findForBranchRole(tenantId, branchId, role);
  return devices.map((d) => d.fcmToken);
}

/** Tenant Admin — never branch-locked (§6A.5), so their device token has no branchId and a
 * branch-scoped query would never match it. Reaches every admin across the whole tenant. */
async function tokensForTenantRole(tenantId: string, role: DeviceStaffRole): Promise<string[]> {
  if (!(await pushEnabled(tenantId))) return [];
  const devices = await deviceTokenRepository.findForTenantRole(tenantId, role);
  return devices.map((d) => d.fcmToken);
}

async function tokensForCustomer(tenantId: string, sessionId: string): Promise<string[]> {
  if (!(await pushEnabled(tenantId))) return [];
  const devices = await deviceTokenRepository.findForOwner(tenantId, "CUSTOMER_SESSION", sessionId);
  return devices.map((d) => d.fcmToken);
}

function orderData(order: OrderLike, type: string): Record<string, string> {
  return { type, orderId: String(order._id), tenantId: String(order.tenantId), branchId: String(order.branchId) };
}

export const notificationService = {
  async notifyKitchenNewOrder(order: OrderLike): Promise<void> {
    const tokens = await tokensForBranchRole(order.tenantId as string, order.branchId as string, "KITCHEN");
    await sendToTokens(tokens, {
      title: "New order placed",
      body: `New order #${order.orderNumber}`,
      data: orderData(order, "order.created"),
    });
  },

  async notifyWaiterOrderReady(order: OrderLike): Promise<void> {
    const tokens = await tokensForBranchRole(order.tenantId as string, order.branchId as string, "WAITER");
    await sendToTokens(tokens, {
      title: "Order ready",
      body: `Order #${order.orderNumber} ready`,
      data: orderData(order, "order.ready"),
    });
  },

  /** Tenant Admin oversees the whole café — new orders and payments both matter to them,
   * even though they aren't the ones actually acting on the order. */
  async notifyAdminNewOrder(order: OrderLike): Promise<void> {
    const tokens = await tokensForTenantRole(order.tenantId as string, "TENANT_ADMIN");
    await sendToTokens(tokens, {
      title: "New order placed",
      body: `Order #${order.orderNumber} — new order received`,
      data: orderData(order, "order.created"),
    });
  },

  async notifyAdminPaymentReceived(order: OrderLike): Promise<void> {
    const tokens = await tokensForTenantRole(order.tenantId as string, "TENANT_ADMIN");
    const amount = order.totalAmount !== undefined ? ` — ₹${order.totalAmount}` : "";
    await sendToTokens(tokens, {
      title: "Payment received",
      body: `Order #${order.orderNumber}${amount}`,
      data: orderData(order, "payment.paid"),
    });
  },

  async notifyCustomerOrderReceived(order: OrderLike): Promise<void> {
    await this.notifyCustomer(order, "order.created", "Your order has been received!", `Order #${order.orderNumber}`);
  },

  async notifyCustomerOrderAccepted(order: OrderLike): Promise<void> {
    await this.notifyCustomer(order, "order.accepted", "Order accepted", "The kitchen is preparing your order");
  },

  async notifyCustomerOrderReady(order: OrderLike): Promise<void> {
    await this.notifyCustomer(order, "order.ready", "Your order is ready!", `Order #${order.orderNumber}`);
  },

  /** Distinct from notifyCustomerOrderReceived — that fires when an online "pay now" order
   * is first created (payment already succeeded by then). This is for the other settlement
   * paths (POS cash/card at the counter, or a pay-later order paid after the fact), where the
   * customer's own device wasn't part of collecting payment and otherwise never hears about it. */
  async notifyCustomerPaymentCompleted(order: OrderLike): Promise<void> {
    await this.notifyCustomer(order, "payment.paid", "Payment received", `Order #${order.orderNumber} — thank you!`);
  },

  async notifyCustomerPaymentFailed(order: OrderLike): Promise<void> {
    await this.notifyCustomer(
      order,
      "payment.failed",
      "Payment failed",
      "Payment failed — please try again",
    );
  },

  async notifyCustomer(order: OrderLike, type: string, title: string, body: string): Promise<void> {
    const sessionId = order.customer?.sessionId;
    if (!sessionId) return; // POS orders have no customer session/device to notify
    const tokens = await tokensForCustomer(order.tenantId as string, String(sessionId));
    await sendToTokens(tokens, { title, body, data: orderData(order, type) });
  },
};
