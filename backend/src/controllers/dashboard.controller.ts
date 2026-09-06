import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { branchIdQuerySchema } from "../validators/table.validators.js";

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  if (!req.tenantId) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  const { branchId } = branchIdQuerySchema.parse(req.query);
  sendSuccess(res, await dashboardService.summary(req.tenantId, branchId));
});
