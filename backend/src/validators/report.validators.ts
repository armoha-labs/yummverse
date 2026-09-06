import { z } from "zod";
import { REPORT_TYPES, EXPORT_FORMATS } from "../services/reportExport.service.js";

export const reportRangeQuerySchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const exportReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  format: z.enum(EXPORT_FORMATS),
  branchId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
