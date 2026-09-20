import { orderRepository } from "../repositories/order.repository.js";
import { paymentRepository } from "../repositories/payment.repository.js";
import { tableRepository } from "../repositories/table.repository.js";
import { nextSequence } from "../models/Counter.js";
import {
  resolveEffectiveRates,
  calculateOrderTotals,
  resolveOrderLines,
  resolvePosCardEnabled,
} from "./orderCalculation.service.js";
import { paymentService } from "./payment.service.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";
import { notificationService } from "../notifications/NotificationService.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/ApiError.js";
import type { CreateOrderItemInput } from "./order.service.js";

function fireAndForget(promise: Promise<void>): void {
  promise.catch((err: unknown) => logger.warn({ err }, "Push notification failed"));
}

export interface CreatePosOrderInput {
  items: CreateOrderItemInput[];
  tableId?: string;
}

export type PosPaymentMethod = "CASH" | "POS_CARD" | "PAYMENT_LINK";

const NOT_COLLECTIBLE_STATUSES = new Set(["CANCELLED", "REFUND_PENDING", "REFUNDED"]);

interface PosActor {
  tenantId: string;
  branchId: string;
  userId: string;
}

export const posService = {
  async createOrder(actor: PosActor, input: CreatePosOrderInput) {
    let tableLabel = "Takeaway";
    if (input.tableId) {
      const table = await tableRepository.findById(actor.tenantId, input.tableId);
      if (!table || table.branchId.toString() !== actor.branchId) {
        throw ApiError.notFound("TABLE_NOT_FOUND", "Table not found.");
      }
      tableLabel = `Table ${table.tableNumber}`;
    }

    const lines = await resolveOrderLines(actor.tenantId, actor.branchId, input.items);
    const rates = await resolveEffectiveRates(actor.tenantId, actor.branchId);
    const totals = calculateOrderTotals(lines, rates);
    const orderNumber = await nextSequence(`${actor.tenantId}:${actor.branchId}`);

    const order = await orderRepository.create({
      tenantId: actor.tenantId,
      branchId: actor.branchId,
      channel: "POS",
      tableId: input.tableId,
      orderNumber,
      customer: { name: tableLabel },
      createdByUserId: actor.userId,
      items: lines.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxPercentage: line.taxPercentage,
        total: line.unitPrice * line.quantity,
        note: line.note,
      })),
      ...totals,
      paymentStatus: "PENDING",
      orderStatus: "PENDING_PAYMENT",
    });

    return order;
  },

  /**
   * §23A.3's three settlement paths. CASH settles immediately (no gateway involved).
   * POS_CARD trusts the staff-operated terminal's confirmation for now — wiring a real
   * card-present verification API (Razorpay POS / Pine Labs) is explicitly a hardware/SDK
   * integration (§23A.5) this environment can't exercise, so it is *not* pretend-verified
   * here, and is gated behind its own tenant/branch setting (default off) so it's only
   * offered once a café actually has that terminal/SDK in place. PAYMENT_LINK reuses the
   * same gateway-order flow as online QR payment and is confirmed the same way: via the
   * payment webhook (§37), since the customer pays on their own device, not the POS session.
   */
  async pay(actor: Omit<PosActor, "branchId"> & { branchId?: string }, orderId: string, method: PosPaymentMethod) {
    const order = await orderRepository.findById(actor.tenantId, orderId);
    if (!order || (actor.branchId && order.branchId.toString() !== actor.branchId)) {
      throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
    }
    // A pay-later order (§23) is already NEW/ACCEPTED/… by the time staff collect payment —
    // only paymentStatus, not orderStatus, tells us whether it's still owed.
    if (order.paymentStatus === "PAID" || NOT_COLLECTIBLE_STATUSES.has(order.orderStatus)) {
      throw ApiError.conflict("ORDER_NOT_PAYABLE", "This order is not awaiting payment.");
    }
    const branchId = order.branchId.toString();
    const enteringKitchen = order.orderStatus === "PENDING_PAYMENT";

    if (method === "PAYMENT_LINK") {
      return paymentService.createPayment({ tenantId: actor.tenantId, branchId }, orderId);
    }

    if (method === "POS_CARD" && !(await resolvePosCardEnabled(actor.tenantId, branchId))) {
      throw ApiError.badRequest(
        "POS_CARD_DISABLED",
        "Card payment via POS terminal isn't enabled for this café yet.",
      );
    }

    const payment = await paymentRepository.create({
      tenantId: actor.tenantId,
      branchId,
      orderId: order._id,
      amount: order.totalAmount,
      currency: "INR", // platform default (§6); no gateway settings lookup for cash/card-present
      status: "PAID",
      method,
    });

    order.paymentId = payment._id;
    order.paymentStatus = "PAID";
    order.paymentMethod = method;
    // Only push a still-PENDING_PAYMENT order into the kitchen queue here — a pay-later
    // order is there already and may be mid-preparation; don't roll its progress back.
    if (enteringKitchen) order.orderStatus = "NEW";
    await order.save();

    realtimeEvents.paymentEvent(actor.tenantId, branchId, "payment.paid", payment);
    if (enteringKitchen) realtimeEvents.orderCreated(actor.tenantId, branchId, order);

    // §40A: parallel to the Socket.IO events above, for a backgrounded client. Never the
    // sole delivery mechanism, never awaited into the request path.
    if (enteringKitchen) {
      fireAndForget(notificationService.notifyKitchenNewOrder(order));
      fireAndForget(notificationService.notifyAdminNewOrder(order));
    }
    fireAndForget(notificationService.notifyAdminPaymentReceived(order));
    // No-ops internally when there's no customer session (a pure walk-in POS order) — the
    // guard already lives in notifyCustomer, so this is always safe to call.
    fireAndForget(notificationService.notifyCustomerPaymentCompleted(order));

    return { order, payment };
  },
};
