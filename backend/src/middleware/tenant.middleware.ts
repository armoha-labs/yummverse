import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Attaches tenant/branch context from the verified token only (§5.1, §34) — never from a
 * client-supplied query/body param. Must run after requireAuth. Platform Admin requests
 * never carry a tenantId here; they select a tenant explicitly per-endpoint (§5.2).
 *
 * Re-checks the tenant's status on every request rather than only at login — an access
 * token can stay valid for up to ACCESS_TOKEN_TTL, and a refresh token for far longer, so
 * suspending/cancelling a tenant must take effect immediately, not just block future logins.
 */
export const attachTenantContext = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth || req.auth.role === "PLATFORM_ADMIN") {
    throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED", "This action requires a tenant-scoped session.");
  }

  const tenant = await tenantRepository.findById(req.auth.tenantId);
  if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "CANCELLED") {
    throw ApiError.forbidden("TENANT_UNAVAILABLE", "This café is temporarily unavailable.");
  }

  req.tenantId = req.auth.tenantId;
  if (req.auth.role === "WAITER" || req.auth.role === "KITCHEN") {
    req.branchId = req.auth.branchId;
  }
  next();
});
