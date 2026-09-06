import type { Request, Response } from "express";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { tenantService } from "../services/tenant.service.js";
import { tenantSettingsService } from "../services/tenantSettings.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { updateProfileSchema, updateSettingsSchema, updateBrandingSchema } from "../validators/tenant.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) {
    throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  }
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND");
  sendSuccess(res, tenant);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const updates = updateProfileSchema.parse(req.body);
  const tenant = await tenantService.updateProfile(tenantId, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, tenant);
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const settings = await tenantSettingsService.getOrCreate(tenantId);
  sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const updates = updateSettingsSchema.parse(req.body);
  const settings = await tenantSettingsService.update(tenantId, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, settings);
});

export const getBranding = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND");
  sendSuccess(res, tenant.branding ?? {});
});

export const updateBranding = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const updates = updateBrandingSchema.parse(req.body);
  const tenant = await tenantService.updateBranding(tenantId, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, tenant.branding);
});

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  if (!req.file) throw ApiError.badRequest("FILE_REQUIRED", "No file uploaded.");

  const tenant = await tenantService.uploadLogo(
    tenantId,
    "logo",
    { buffer: req.file.buffer, mimeType: req.file.mimetype, originalName: req.file.originalname },
    { actorId, ...actorMeta(req) },
  );
  sendSuccess(res, tenant.branding);
});

export const deleteLogo = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const tenant = await tenantService.removeLogo(tenantId, { actorId, ...actorMeta(req) });
  sendSuccess(res, tenant.branding);
});
