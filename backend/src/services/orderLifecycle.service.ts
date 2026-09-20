import { Order, type OrderStatus } from "../models/Order.js";
import { orderRepository } from "../repositories/order.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";
import { notificationService } from "../notifications/NotificationService.js";
import { resolveKitchenEnabled } from "./orderCalculation.service.js";
import { logger } from "../config/logger.js";

function fireAndForget(promise: Promise<void>): void {
  promise.catch((err: unknown) => logger.warn({ err }, "Push notification failed"));
}

const ACTIVE_KITCHEN_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY"];

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  timestampField: "acceptedAt" | "preparingAt" | "readyAt" | "servedAt";
  event: "order.accepted" | "order.preparing" | "order.ready" | "order.served";
}

const TRANSITIONS = {
  accept: { from: "NEW", to: "ACCEPTED", timestampField: "acceptedAt", event: "order.accepted" },
  preparing: { from: "ACCEPTED", to: "PREPARING", timestampField: "preparingAt", event: "order.preparing" },
  ready: { from: "PREPARING", to: "READY", timestampField: "readyAt", event: "order.ready" },
  served: { from: "READY", to: "SERVED", timestampField: "servedAt", event: "order.served" },
} as const satisfies Record<string, Transition>;

async function applyTransition(
  tenantId: string,
  // undefined = Tenant Admin acting tenant-wide, not branch-locked (§6A.5); Kitchen/Waiter
  // always pass their token's fixed branchId.
  branchId: string | undefined,
  orderId: string,
  transitionKey: keyof typeof TRANSITIONS,
) {
  const transition = TRANSITIONS[transitionKey];

  const order = await Order.findOne({ _id: orderId, tenantId, ...(branchId ? { branchId } : {}) });
  if (!order) throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");

  // Resolved from the order's own branch (which may differ from the caller's, e.g. a Tenant
  // Admin acting tenant-wide) so a branch-level override always governs orders placed there,
  // even when the tenant-wide default disagrees.
  const kitchenEnabled = await resolveKitchenEnabled(tenantId, order.branchId.toString());

  if (!kitchenEnabled && transitionKey !== "served") {
    throw ApiError.badRequest(
      "KITCHEN_DISABLED",
      "Kitchen workflow is turned off for this café — orders can be marked Served directly.",
    );
  }

  // With no kitchen workflow, an order never passes through ACCEPTED/PREPARING/READY — it
  // just sits in NEW until a waiter/admin serves it directly, so "served" has to be reachable
  // from any of the active statuses rather than strictly from READY.
  const validFrom: OrderStatus[] = !kitchenEnabled && transitionKey === "served" ? ACTIVE_KITCHEN_STATUSES : [transition.from];
  if (!validFrom.includes(order.orderStatus)) {
    throw ApiError.conflict(
      "INVALID_ORDER_TRANSITION",
      `Order is "${order.orderStatus}", expected "${transition.from}" for this action.`,
    );
  }

  order.orderStatus = transition.to;
  order[transition.timestampField] = new Date();
  await order.save();

  realtimeEvents.orderStatusChanged(
    tenantId,
    order.branchId.toString(),
    transition.event,
    order,
    order.customer?.sessionId?.toString(),
  );

  // §40A: push notification in parallel with the Socket.IO event above, for a backgrounded
  // client — never awaited into the request path, and never the sole delivery mechanism.
  if (transitionKey === "accept") {
    fireAndForget(notificationService.notifyCustomerOrderAccepted(order));
  } else if (transitionKey === "ready") {
    fireAndForget(notificationService.notifyCustomerOrderReady(order));
    fireAndForget(notificationService.notifyWaiterOrderReady(order));
  }

  return order;
}

export const orderLifecycleService = {
  // Branch is always the caller's own token branchId for Kitchen/Waiter (§6A.5) — never a param.
  // tableId is populated with just its number — Kitchen is explicitly entitled to "view table
  // number" (§10) but not the rest of the Table document.
  listActiveForBranch(tenantId: string, branchId: string) {
    return Order.find({ tenantId, branchId, orderStatus: { $in: ACTIVE_KITCHEN_STATUSES } })
      .sort({ createdAt: 1 })
      .populate("tableId", "tableNumber");
  },

  // Tenant Admin variant: branchId optional, omitted = every branch (§6A.5, §36's admin/kitchen note).
  listActiveForTenant(tenantId: string, branchId?: string) {
    return Order.find({
      tenantId,
      ...(branchId ? { branchId } : {}),
      orderStatus: { $in: ACTIVE_KITCHEN_STATUSES },
    })
      .sort({ createdAt: 1 })
      .populate("tableId", "tableNumber");
  },

  async getOne(tenantId: string, branchId: string | undefined, orderId: string) {
    const order = await orderRepository.findById(tenantId, orderId);
    if (!order || (branchId && order.branchId.toString() !== branchId)) {
      throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
    }
    await order.populate("tableId", "tableNumber");
    return order;
  },

  accept: (tenantId: string, branchId: string | undefined, orderId: string) =>
    applyTransition(tenantId, branchId, orderId, "accept"),
  preparing: (tenantId: string, branchId: string | undefined, orderId: string) =>
    applyTransition(tenantId, branchId, orderId, "preparing"),
  ready: (tenantId: string, branchId: string | undefined, orderId: string) =>
    applyTransition(tenantId, branchId, orderId, "ready"),
  served: (tenantId: string, branchId: string | undefined, orderId: string) =>
    applyTransition(tenantId, branchId, orderId, "served"),
};
