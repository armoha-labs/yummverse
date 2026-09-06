import type { Request, Response } from "express";
import { staffService } from "../services/staff.service.js";
import { userRepository } from "../repositories/user.repository.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { idParamSchema } from "../validators/common.validators.js";
import { listStaffQuerySchema, createStaffSchema, updateStaffSchema } from "../validators/staff.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { role } = listStaffQuerySchema.parse(req.query);
  const staff = await staffService.listForTenant(tenantId, role);
  sendSuccess(res, staff);
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = createStaffSchema.parse(req.body);
  const { user } = await staffService.create(tenantId, input, { actorId, ...actorMeta(req) });
  sendSuccess(res, user, 201);
});

export const getStaffMember = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const user = await userRepository.findById(tenantId, id);
  if (!user) throw ApiError.notFound("USER_NOT_FOUND");
  sendSuccess(res, user);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const updates = updateStaffSchema.parse(req.body);
  const user = await staffService.update(tenantId, id, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, user);
});

export const deactivateStaff = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const user = await staffService.setActive(tenantId, id, false, { actorId, ...actorMeta(req) });
  sendSuccess(res, user);
});

export const activateStaff = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const user = await staffService.setActive(tenantId, id, true, { actorId, ...actorMeta(req) });
  sendSuccess(res, user);
});

export const resetStaffPassword = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  await staffService.resetPassword(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, { message: "A new set-password link has been issued." });
});
