import { reportService, type ReportRange } from "./report.service.js";
import { toCsv, toExcel, toPdf, type ExportRow } from "../utils/exportFormats.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export const REPORT_TYPES = ["revenue", "tax", "item-performance", "orders", "payments"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const EXPORT_FORMATS = ["csv", "excel", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

async function rowsForReport(tenantId: string, reportType: ReportType, range: ReportRange): Promise<ExportRow[]> {
  switch (reportType) {
    case "revenue": {
      const report = await reportService.revenue(tenantId, range);
      return report.trend.map((t) => ({ date: t.date, amount: t.amount, orderCount: t.orderCount }));
    }
    case "tax": {
      const report = await reportService.tax(tenantId, range);
      return report.byRate.map((r) => ({
        ratePercentage: r.ratePercentage,
        taxableAmount: r.taxableAmount,
        taxCollected: r.taxCollected,
        orderCount: r.orderCount,
      }));
    }
    case "item-performance": {
      const report = await reportService.itemPerformance(tenantId, range);
      return report.topByQuantity.map((i) => ({
        name: i.name,
        quantitySold: i.quantitySold,
        revenue: i.revenue,
        percentOfRevenue: i.percentOfRevenue,
      }));
    }
    case "orders": {
      const report = await reportService.orders(tenantId, range);
      return report.orders.map((o) => ({
        orderNumber: o.orderNumber,
        channel: o.channel,
        status: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt?.toISOString() ?? "",
      }));
    }
    case "payments": {
      const report = await reportService.payments(tenantId, range);
      return report.transactions.map((p) => ({
        provider: p.provider ?? "",
        method: p.method ?? "",
        amount: p.amount,
        refundedAmount: p.refundedAmount ?? 0,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt?.toISOString() ?? "",
      }));
    }
  }
}

export const reportExportService = {
  async export(
    tenantId: string,
    input: { reportType: ReportType; format: ExportFormat; range: ReportRange },
    actor: Actor,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const rows = await rowsForReport(tenantId, input.reportType, input.range);

    const datePart = `${input.range.dateFrom.toISOString().slice(0, 10)}_${input.range.dateTo
      .toISOString()
      .slice(0, 10)}`;
    const baseName = `${input.reportType}_${datePart}`;

    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    if (input.format === "csv") {
      buffer = await toCsv(rows);
      contentType = "text/csv";
      filename = `${baseName}.csv`;
    } else if (input.format === "excel") {
      buffer = await toExcel(rows, input.reportType);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `${baseName}.xlsx`;
    } else if (input.format === "pdf") {
      buffer = await toPdf(`${input.reportType} report`, rows);
      contentType = "application/pdf";
      filename = `${baseName}.pdf`;
    } else {
      throw ApiError.badRequest("UNSUPPORTED_FORMAT", "Unsupported export format.");
    }

    // §46.3: every export is an audit event — report type, format, date range, requester.
    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "REPORT_EXPORTED",
      entityType: "Report",
      entityId: tenantId,
      after: { reportType: input.reportType, format: input.format, range: input.range },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { buffer, filename, contentType };
  },
};
