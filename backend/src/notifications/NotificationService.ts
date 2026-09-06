import { deviceTokenRepository } from "../repositories/deviceToken.repository.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { tenantLimitsService } from "../services/tenantLimits.service.js";

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

async function tokensFor(tenantId: string, branchId: string, ownerType: "USER" | "CUSTOMER_SESSION", ownerId?: string) {
  const limits = await tenantLimitsService.resolveEffectiveLimits(tenantId);
  if (!limits.firebasePushEnabled) return [];

  const devices = ownerId
    ? await deviceTokenRepository.findForOwner(tenantId, ownerType, ownerId)
    : await deviceTokenRepository.findForOwnerType(tenantId, branchId, ownerType);
  return devices.map((d) => d.fcmToken);
}

export const notificationService = {
  async notifyKitchenNewOrder(order: OrderLike): Promise<void> {
    const tokens = await tokensFor(order.tenantId as string, order.branchId as string, "USER");
    await sendToTokens(tokens, {
      title: "New order placed",
      body: `New order #${order.orderNumber}`,
      data: { type: "order.created", orderId: String(order._id), tenantId: String(order.tenantId), branchId: String(order.branchId) },
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

  async notifyCustomerPaymentFailed(order: OrderLike): Promise<void> {
    await this.notifyCustomer(
      order,
      "payment.failed",
      "Payment failed",
      "Payment failed — please try again",
    );
  },

  async notifyWaiterOrderReady(order: OrderLike): Promise<void> {
    const tokens = await tokensFor(order.tenantId as string, order.branchId as string, "USER");
    await sendToTokens(tokens, {
      title: "Order ready",
      body: `Order #${order.orderNumber} ready`,
      data: { type: "order.ready", orderId: String(order._id), tenantId: String(order.tenantId), branchId: String(order.branchId) },
    });
  },

  async notifyCustomer(order: OrderLike, type: string, title: string, body: string): Promise<void> {
    const sessionId = order.customer?.sessionId;
    if (!sessionId) return; // POS orders have no customer session/device to notify
    const tokens = await tokensFor(order.tenantId as string, order.branchId as string, "CUSTOMER_SESSION", String(sessionId));
    await sendToTokens(tokens, {
      title,
      body,
      data: { type, orderId: String(order._id), tenantId: String(order.tenantId), branchId: String(order.branchId) },
    });
  },
};
