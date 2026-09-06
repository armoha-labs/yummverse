import { reportService } from "./report.service.js";
import { orderLifecycleService } from "./orderLifecycle.service.js";
import { Table } from "../models/Table.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const dashboardService = {
  async summary(tenantId: string, branchId?: string) {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - SEVEN_DAYS_MS);

    const [revenue, activeOrders, tables] = await Promise.all([
      reportService.revenue(tenantId, { branchId, dateFrom, dateTo }),
      orderLifecycleService.listActiveForTenant(tenantId, branchId),
      Table.find({ tenantId, ...(branchId ? { branchId } : {}) }),
    ]);

    const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;

    return {
      last7Days: {
        grossRevenue: revenue.grossRevenue,
        netRevenue: revenue.netRevenue,
        orderCount: revenue.orderCount,
        averageOrderValue: revenue.averageOrderValue,
        grossRevenueChangePct: revenue.grossRevenueChangePct,
      },
      activeOrderCount: activeOrders.length,
      tables: { total: tables.length, occupied: occupiedTables, available: tables.length - occupiedTables },
    };
  },
};
