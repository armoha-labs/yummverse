import { reportService, type ReportRange } from "./report.service.js";
import { toCsv, toExcel, toPdf, type ExportRow } from "../utils/exportFormats.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { logger } from "../config/logger.js";
import { ApiError } from "../utils/ApiError.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export const REPORT_TYPES = ["revenue", "tax", "item-performance", "orders", "payments"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_TITLES: Record<ReportType, string> = {
  revenue: "Revenue Report",
  tax: "Tax Report",
  "item-performance": "Item Performance Report",
  orders: "Orders Report",
  payments: "Payments Report",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/;

/** CSV/Excel keep full ISO timestamps (correct for spreadsheet reimport) — the PDF is read
 * by a person, not re-parsed by software, so a raw ISO string there just wraps awkwardly
 * across two lines in a narrow table column instead of reading as a date. */
function formatRowsForPdf(rows: ExportRow[]): ExportRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (typeof value === "string" && ISO_DATE_RE.test(value)) {
          const date = new Date(value);
          const formatted = value.includes("T")
            ? date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
          return [key, formatted];
        }
        return [key, value];
      }),
    ),
  );
}

/** Best-effort — a missing/unreachable logo degrades to a text-only PDF header rather than
 * failing the whole export (same "never let a cosmetic extra break the core action"
 * philosophy as everywhere else optional media is fetched in this codebase). */
async function fetchLogo(logoUrl: string | undefined): Promise<Buffer | undefined> {
  if (!logoUrl) return undefined;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    logger.warn({ err, logoUrl }, "Report PDF: failed to fetch tenant logo, continuing without it");
    return undefined;
  }
}

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
      const tenant = await tenantRepository.findById(tenantId);
      const logo = await fetchLogo(tenant?.branding?.logoUrl ?? undefined);
      buffer = await toPdf(
        {
          tenantName: tenant?.name ?? "Yummverse",
          reportTitle: REPORT_TITLES[input.reportType],
          dateFrom: input.range.dateFrom,
          dateTo: input.range.dateTo,
          logo,
        },
        formatRowsForPdf(rows),
      );
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
