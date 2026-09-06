import type { Request, Response } from "express";
import { reportService, type ReportRange } from "../services/report.service.js";
import { reportExportService } from "../services/reportExport.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { reportRangeQuerySchema, exportReportSchema } from "../validators/report.validators.js";

const DEFAULT_RANGE_DAYS = 30;

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function resolveRange(input: { branchId?: string; dateFrom?: Date; dateTo?: Date }): ReportRange {
  const dateTo = input.dateTo ?? new Date();
  const dateFrom = input.dateFrom ?? new Date(dateTo.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { branchId: input.branchId, dateFrom, dateTo };
}

export const getRevenueReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const range = resolveRange(reportRangeQuerySchema.parse(req.query));
  sendSuccess(res, await reportService.revenue(tenantId, range));
});

export const getTaxReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const range = resolveRange(reportRangeQuerySchema.parse(req.query));
  sendSuccess(res, await reportService.tax(tenantId, range));
});

export const getItemPerformanceReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const range = resolveRange(reportRangeQuerySchema.parse(req.query));
  sendSuccess(res, await reportService.itemPerformance(tenantId, range));
});

export const getOrdersReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const range = resolveRange(reportRangeQuerySchema.parse(req.query));
  sendSuccess(res, await reportService.orders(tenantId, range));
});

export const getPaymentsReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const range = resolveRange(reportRangeQuerySchema.parse(req.query));
  sendSuccess(res, await reportService.payments(tenantId, range));
});

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = exportReportSchema.parse(req.body);
  const range = resolveRange(input);

  // Synchronous export only (no background job queue in this build) — fine at this data
  // scale; §46.3's async path is a future enhancement once volumes warrant it.
  const { buffer, filename, contentType } = await reportExportService.export(
    tenantId,
    { reportType: input.reportType, format: input.format, range },
    { actorId, ipAddress: req.ip, userAgent: req.headers["user-agent"] },
  );

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});
