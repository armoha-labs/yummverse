import type { Request, Response } from "express";
import { branchService } from "../services/branch.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { branchRepository } from "../repositories/branch.repository.js";
import { createBranchSchema, updateBranchSchema } from "../validators/branch.validators.js";
import { idParamSchema } from "../validators/common.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const branches = await branchService.listForTenant(tenantId);
  sendSuccess(res, branches);
});

export const getBranch = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const branch = await branchRepository.findById(tenantId, id);
  if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND");
  sendSuccess(res, branch);
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = createBranchSchema.parse(req.body);
  const branch = await branchService.create(tenantId, input, { actorId, ...actorMeta(req) });
  sendSuccess(res, branch, 201);
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const updates = updateBranchSchema.parse(req.body);
  const branch = await branchService.update(tenantId, id, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, branch);
});

export const deactivateBranch = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const branch = await branchService.deactivate(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, branch);
});
