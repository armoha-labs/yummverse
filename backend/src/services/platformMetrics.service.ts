import { Tenant } from "../models/Tenant.js";
import { Order } from "../models/Order.js";
import { tenantRepository } from "../repositories/tenant.repository.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const RENEWAL_WARNING_MS = 7 * 24 * 60 * 60 * 1000;

export const platformMetricsService = {
  async summary() {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - THIRTY_DAYS_MS);

    const [tenantsByStatus, revenue, renewalsDueSoon] = await Promise.all([
      Tenant.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { paymentStatus: "PAID", createdAt: { $gte: dateFrom, $lte: dateTo } } },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
      ]),
      tenantRepository.countActiveWithEndDateBefore(new Date(dateTo.getTime() + RENEWAL_WARNING_MS)),
    ]);

    const statusCounts = Object.fromEntries(tenantsByStatus.map((t) => [t._id, t.count]));

    return {
      tenants: {
        total: tenantsByStatus.reduce((sum, t) => sum + t.count, 0),
        active: statusCounts.ACTIVE ?? 0,
        trial: statusCounts.TRIAL ?? 0,
        suspended: statusCounts.SUSPENDED ?? 0,
        cancelled: statusCounts.CANCELLED ?? 0,
      },
      last30Days: {
        platformWideRevenue: revenue[0]?.revenue ?? 0,
        orderCount: revenue[0]?.orderCount ?? 0,
      },
      renewalsDueSoon,
    };
  },
};
