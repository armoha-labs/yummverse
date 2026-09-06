import { orderRepository } from "../repositories/order.repository.js";
import { nextSequence } from "../models/Counter.js";
import {
  resolveEffectiveRates,
  calculateOrderTotals,
  resolveOrderLines,
  resolveAllowPayLater,
} from "./orderCalculation.service.js";
import { ApiError } from "../utils/ApiError.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";
import { notificationService } from "../notifications/NotificationService.js";
import { logger } from "../config/logger.js";
import type { CustomerSessionContext } from "../types/express.js";
import type { OrderDocument } from "../models/Order.js";

export interface CreateOrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone?: string;
  items: CreateOrderItemInput[];
  /** Customer opted to pay at the counter instead of online now (§23) — only honored when
   * the branch (or tenant default) actually allows it; otherwise rejected. */
  payLater?: boolean;
}

/** An order becomes visible to the kitchen either via a confirmed online payment
 * (payment.service's verifyPayment) or, here, via a pay-later opt-in at order creation —
 * both are the same "this order just entered the kitchen queue" moment. */
export function notifyOrderEnteredKitchen(order: OrderDocument): void {
  realtimeEvents.orderCreated(order.tenantId.toString(), order.branchId.toString(), order);
  notificationService.notifyKitchenNewOrder(order).catch((err: unknown) => logger.warn({ err }, "Push notification failed"));
  notificationService
    .notifyCustomerOrderReceived(order)
    .catch((err: unknown) => logger.warn({ err }, "Push notification failed"));
}

export const orderService = {
  async createFromCustomerSession(session: CustomerSessionContext, input: CreateOrderInput) {
    const lines = await resolveOrderLines(session.tenantId, session.branchId, input.items);
    const rates = await resolveEffectiveRates(session.tenantId, session.branchId);
    const totals = calculateOrderTotals(lines, rates);
    const orderNumber = await nextSequence(`${session.tenantId}:${session.branchId}`);

    let payLater = false;
    if (input.payLater) {
      const allowed = await resolveAllowPayLater(session.tenantId, session.branchId);
      if (!allowed) {
        throw ApiError.forbidden("PAY_LATER_NOT_ALLOWED", "This café requires payment at checkout.");
      }
      payLater = true;
    }

    const order = await orderRepository.create({
      tenantId: session.tenantId,
      branchId: session.branchId,
      channel: "QR",
      tableId: session.tableId,
      orderNumber,
      customer: { sessionId: session.sessionId, name: input.customerName, phone: input.customerPhone },
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
      orderStatus: payLater ? "NEW" : "PENDING_PAYMENT",
    });

    if (payLater) notifyOrderEnteredKitchen(order);

    return order;
  },

  async getForSession(session: CustomerSessionContext, orderId: string) {
    const order = await orderRepository.findById(session.tenantId, orderId);
    if (!order || order.customer?.sessionId?.toString() !== session.sessionId) {
      // Same 404 whether the order doesn't exist or belongs to another session at this
      // table (§57) — never confirm existence of another session's order.
      throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
    }
    return order;
  },
};
