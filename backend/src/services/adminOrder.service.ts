import { Order, type OrderStatus } from "../models/Order.js";
import { orderRepository } from "../repositories/order.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

const CANCELLABLE_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING"];

export interface OrderListFilters {
  branchId?: string;
  status?: OrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export const adminOrderService = {
  list(tenantId: string, filters: OrderListFilters) {
    return Order.find({
      tenantId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.status ? { orderStatus: filters.status } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
            },
          }
        : {}),
    }).sort({ createdAt: -1 });
  },

  async getOne(tenantId: string, orderId: string) {
    const order = await orderRepository.findById(tenantId, orderId);
    if (!order) throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
    return order;
  },

  /** §25's cancellation path: NEW/ACCEPTED/PREPARING -> CANCELLED -> (REFUND_PENDING if paid). */
  async cancel(tenantId: string, orderId: string, actor: Actor) {
    const order = await this.getOne(tenantId, orderId);
    if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      throw ApiError.conflict(
        "ORDER_NOT_CANCELLABLE",
        `Order is "${order.orderStatus}" and can no longer be cancelled.`,
      );
    }

    order.cancelledAt = new Date();
    order.orderStatus = order.paymentStatus === "PAID" ? "REFUND_PENDING" : "CANCELLED";
    await order.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "ORDER_CANCELLED",
      entityType: "Order",
      entityId: order._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return order;
  },
};
