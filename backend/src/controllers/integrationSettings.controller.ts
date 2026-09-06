import type { Request, Response } from "express";
import { integrationSettingsService } from "../services/integrationSettings.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { providerParamSchema, upsertIntegrationSettingsSchema } from "../validators/integrationSettings.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listIntegrationSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  sendSuccess(res, await integrationSettingsService.list(tenantId));
});

export const upsertIntegrationSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { provider } = providerParamSchema.parse(req.params);
  const input = upsertIntegrationSettingsSchema.parse(req.body);
  const result = await integrationSettingsService.upsert(tenantId, provider, input, {
    actorId,
    ...actorMeta(req),
  });
  sendSuccess(res, result);
});
