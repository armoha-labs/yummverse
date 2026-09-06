import type { Request, Response } from "express";
import { paymentSettingsService } from "../services/paymentSettings.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  branchIdQuerySchema,
  upsertPaymentSettingsSchema,
  copyPaymentSettingsSchema,
} from "../validators/paymentSettings.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const getPaymentSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  const settings = await paymentSettingsService.getResolved(tenantId, branchId);
  sendSuccess(res, settings);
});

export const upsertPaymentSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  const input = upsertPaymentSettingsSchema.parse(req.body);
  const settings = await paymentSettingsService.upsert(tenantId, branchId, input, {
    actorId,
    ...actorMeta(req),
  });
  sendSuccess(res, settings);
});

export const deletePaymentSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  if (!branchId) {
    throw ApiError.badRequest("BRANCH_ID_REQUIRED", "branchId is required to clear a branch override.");
  }
  await paymentSettingsService.clearOverride(tenantId, branchId, { actorId, ...actorMeta(req) });
  sendSuccess(res, { message: "Branch override cleared; using tenant-wide default." });
});

export const testPaymentConnection = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  const result = await paymentSettingsService.testConnection(tenantId, branchId);
  sendSuccess(res, result);
});

export const copyPaymentSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { fromBranchId, toBranchId } = copyPaymentSettingsSchema.parse(req.body);
  const fields = await paymentSettingsService.copyFields(tenantId, fromBranchId, toBranchId);
  sendSuccess(res, fields);
});
