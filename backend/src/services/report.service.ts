import { Types } from "mongoose";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { branchRepository } from "../repositories/branch.repository.js";

export interface ReportRange {
  branchId?: string;
  dateFrom: Date;
  dateTo: Date;
}

function matchStage(tenantId: string, range: ReportRange, extra: Record<string, unknown> = {}) {
  return {
    tenantId: new Types.ObjectId(tenantId),
    ...(range.branchId ? { branchId: new Types.ObjectId(range.branchId) } : {}),
    createdAt: { $gte: range.dateFrom, $lte: range.dateTo },
    ...extra,
  };
}

function previousPeriod(range: ReportRange): ReportRange {
  const spanMs = range.dateTo.getTime() - range.dateFrom.getTime();
  return {
    branchId: range.branchId,
    dateFrom: new Date(range.dateFrom.getTime() - spanMs),
    dateTo: new Date(range.dateFrom.getTime()),
  };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // undefined % change from a zero base
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function branchNameMap(tenantId: string): Promise<Map<string, string>> {
  const branches = await branchRepository.listForTenant(tenantId);
  return new Map(branches.map((b) => [b._id.toString(), b.name]));
}

export const reportService = {
  async revenue(tenantId: string, range: ReportRange) {
    const paidMatch = matchStage(tenantId, range, { paymentStatus: "PAID" });

    const [current, previous, byMethod, trend] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: null, gross: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: matchStage(tenantId, previousPeriod(range), { paymentStatus: "PAID" }) },
        { $group: { _id: null, gross: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: matchStage(tenantId, range, { status: "PAID" }) },
        { $group: { _id: "$method", amount: { $sum: "$amount" } } },
      ]),
      Order.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$totalAmount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const refunds = await Payment.aggregate([
      { $match: matchStage(tenantId, range, { refundedAmount: { $gt: 0 } }) },
      { $group: { _id: null, amount: { $sum: "$refundedAmount" } } },
    ]);

    const gross = current[0]?.gross ?? 0;
    const orderCount = current[0]?.count ?? 0;
    const refundTotal = refunds[0]?.amount ?? 0;
    const net = gross - refundTotal;
    const prevGross = previous[0]?.gross ?? 0;
    const prevCount = previous[0]?.count ?? 0;

    return {
      grossRevenue: gross,
      netRevenue: net,
      averageOrderValue: orderCount > 0 ? Math.round((net / orderCount) * 100) / 100 : 0,
      orderCount,
      grossRevenueChangePct: percentChange(gross, prevGross),
      orderCountChangePct: percentChange(orderCount, prevCount),
      revenueByPaymentMethod: byMethod.map((m) => ({ method: m._id ?? "UNKNOWN", amount: m.amount })),
      trend: trend.map((t) => ({ date: t._id, amount: t.amount, orderCount: t.count })),
    };
  },

  async tax(tenantId: string, range: ReportRange) {
    const paidMatch = matchStage(tenantId, range, { paymentStatus: "PAID" });

    const [totals, byRate, byBranch, branchNames] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: null, taxCollected: { $sum: "$taxAmount" }, taxableAmount: { $sum: "$subtotal" } } },
      ]),
      Order.aggregate([
        // Only orders that actually had tax charged (tenant/branch tax.enabled was true at
        // order time, §orderCalculation) — otherwise this would recompute a rate breakdown
        // that doesn't match totalTaxCollected above, which reflects what was really charged.
        { $match: { ...paidMatch, taxAmount: { $gt: 0 } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.taxPercentage",
            taxableAmount: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
            taxCollected: {
              $sum: {
                $divide: [
                  { $multiply: ["$items.unitPrice", "$items.quantity", "$items.taxPercentage"] },
                  100,
                ],
              },
            },
            orderIds: { $addToSet: "$_id" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: matchStage(tenantId, range, { paymentStatus: "PAID" }) },
        { $group: { _id: "$branchId", taxCollected: { $sum: "$taxAmount" } } },
      ]),
      branchNameMap(tenantId),
    ]);

    // CGST/SGST are always an exact even split of taxAmount (orderCalculation.service.ts) —
    // derived here from the aggregated total rather than summed from each order's own
    // cgstAmount/sgstAmount fields, so orders placed before that split was introduced (which
    // have no such fields) still report a correct, consistent breakdown.
    const totalTaxCollected = totals[0]?.taxCollected ?? 0;
    const totalCgst = Math.round((totalTaxCollected / 2) * 100) / 100;

    return {
      totalTaxCollected,
      totalCgstCollected: totalCgst,
      totalSgstCollected: Math.round((totalTaxCollected - totalCgst) * 100) / 100,
      taxableOrderAmount: totals[0]?.taxableAmount ?? 0,
      byRate: byRate.map((r) => {
        const taxCollected = Math.round(r.taxCollected * 100) / 100;
        const cgstCollected = Math.round((taxCollected / 2) * 100) / 100;
        return {
          ratePercentage: r._id,
          taxableAmount: r.taxableAmount,
          taxCollected,
          cgstCollected,
          sgstCollected: Math.round((taxCollected - cgstCollected) * 100) / 100,
          orderCount: r.orderIds.length,
        };
      }),
      byBranch: byBranch.map((b) => ({
        branchId: b._id,
        branchName: branchNames.get(b._id?.toString()) ?? "Unknown Branch",
        taxCollected: b.taxCollected,
      })),
    };
  },

  async itemPerformance(tenantId: string, range: ReportRange) {
    const paidMatch = matchStage(tenantId, range, { paymentStatus: "PAID" });
    const prevMatch = matchStage(tenantId, previousPeriod(range), { paymentStatus: "PAID" });

    const [current, previous] = await Promise.all([
      Order.aggregate([
        { $match: paidMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.menuItemId",
            name: { $first: "$items.name" },
            quantitySold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.total" },
          },
        },
      ]),
      Order.aggregate([
        { $match: prevMatch },
        { $unwind: "$items" },
        { $group: { _id: "$items.menuItemId", quantitySold: { $sum: "$items.quantity" } } },
      ]),
    ]);

    const previousByItem = new Map(previous.map((p) => [p._id.toString(), p.quantitySold]));
    const totalRevenue = current.reduce((sum, i) => sum + i.revenue, 0);

    const items = current
      .map((i) => ({
        menuItemId: i._id,
        name: i.name,
        quantitySold: i.quantitySold,
        revenue: i.revenue,
        percentOfRevenue: totalRevenue > 0 ? Math.round((i.revenue / totalRevenue) * 1000) / 10 : 0,
        trendPct: percentChange(i.quantitySold, previousByItem.get(i._id.toString()) ?? 0),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      topByQuantity: items.slice(0, 10),
      topByRevenue: [...items].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      slowMoving: [...items].sort((a, b) => a.quantitySold - b.quantitySold).slice(0, 5),
    };
  },

  async orders(tenantId: string, range: ReportRange) {
    const match = matchStage(tenantId, range);
    const [statusBreakdown, orders] = await Promise.all([
      Order.aggregate([{ $match: match }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
      Order.find(match).sort({ createdAt: -1 }).limit(500),
    ]);

    return {
      statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
      orders,
    };
  },

  async payments(tenantId: string, range: ReportRange) {
    const match = matchStage(tenantId, range);
    const [payments, refunds] = await Promise.all([
      Payment.find(match).sort({ createdAt: -1 }).limit(500),
      Payment.aggregate([
        { $match: { ...match, refundedAmount: { $gt: 0 } } },
        { $group: { _id: null, amount: { $sum: "$refundedAmount" }, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      transactions: payments,
      refundTotal: refunds[0]?.amount ?? 0,
      refundCount: refunds[0]?.count ?? 0,
    };
  },
};
