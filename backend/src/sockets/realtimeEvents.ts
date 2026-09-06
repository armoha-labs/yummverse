import { getIo } from "./socketServer.js";
import { rooms } from "./rooms.js";

/** Each event carries its tenant/branch context internally (§40) — callers never need to
 * re-derive it. No-ops if the socket server hasn't been started (e.g. under test). */
function emit(room: string, event: string, payload: unknown): void {
  getIo()?.to(room).emit(event, payload);
}

export const realtimeEvents = {
  orderCreated(tenantId: string, branchId: string, order: unknown) {
    emit(rooms.kitchen(tenantId, branchId), "order.created", order);
    emit(rooms.tenantAdmin(tenantId), "order.created", order);
  },

  orderStatusChanged(
    tenantId: string,
    branchId: string,
    event: "order.accepted" | "order.preparing" | "order.ready" | "order.served" | "order.completed",
    order: unknown,
    sessionId?: string,
  ) {
    emit(rooms.kitchen(tenantId, branchId), event, order);
    emit(rooms.waiters(tenantId, branchId), event, order);
    emit(rooms.tenantAdmin(tenantId), event, order);
    if (sessionId) emit(rooms.customer(sessionId), event, order);
  },

  paymentEvent(
    tenantId: string,
    branchId: string,
    event: "payment.created" | "payment.paid" | "payment.failed",
    payment: unknown,
    sessionId?: string,
  ) {
    emit(rooms.tenantAdmin(tenantId), event, payment);
    if (sessionId) emit(rooms.customer(sessionId), event, payment);
  },

  tableStatusChanged(tenantId: string, branchId: string, table: unknown) {
    emit(rooms.waiters(tenantId, branchId), "table.statusChanged", table);
    emit(rooms.tenantAdmin(tenantId), "table.statusChanged", table);
  },

  menuAvailabilityChanged(tenantId: string, menuItem: unknown) {
    emit(rooms.tenantAdmin(tenantId), "menu.availabilityChanged", menuItem);
  },
};
