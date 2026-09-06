import { tenantRepository } from "../repositories/tenant.repository.js";
import { ApiError } from "../utils/ApiError.js";
import type { TenantDocument } from "../models/Tenant.js";
import type { Types } from "mongoose";

export type ResolvedTenant = TenantDocument & { _id: Types.ObjectId };

/**
 * Resolves a tenant from its public slug — the only trusted way to derive tenant identity
 * from a URL/login form (§32). This is a public lookup: name/logo/colors only, no auth data.
 */
export async function resolveTenantBySlug(slug: string): Promise<ResolvedTenant> {
  const tenant = await tenantRepository.findBySlug(slug.toLowerCase());
  if (!tenant) {
    throw ApiError.notFound("TENANT_NOT_FOUND", "No café found for this address.");
  }
  return tenant as ResolvedTenant;
}
