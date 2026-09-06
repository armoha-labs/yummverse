import { tenantFeatureLimitsRepository } from "../repositories/tenantFeatureLimits.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { PLAN_LIMITS, HARD_CEILING, type PlanId, type PlanLimits } from "../config/plans.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

function planLimitsFor(planId: string | undefined): PlanLimits {
  return PLAN_LIMITS[(planId as PlanId) ?? "FREE"] ?? HARD_CEILING;
}

/** §7A.2's resolution order: tenant-specific override → plan default → hard ceiling. */
export const tenantLimitsService = {
  async resolveEffectiveLimits(tenantId: string): Promise<PlanLimits> {
    const [tenant, featureLimits] = await Promise.all([
      tenantRepository.findById(tenantId),
      tenantFeatureLimitsRepository.findByTenant(tenantId),
    ]);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    const planDefaults = planLimitsFor(tenant.subscription?.planId);
    const overrides = featureLimits?.overrides ?? {};

    const merged: PlanLimits = { ...HARD_CEILING, ...planDefaults };
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== null) {
        (merged as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return merged;
  },

  async resolveMaxBranches(tenantId: string): Promise<number> {
    const limits = await this.resolveEffectiveLimits(tenantId);
    return limits.maxBranches;
  },

  async getRaw(tenantId: string) {
    const [tenant, featureLimits] = await Promise.all([
      tenantRepository.findById(tenantId),
      tenantFeatureLimitsRepository.findByTenant(tenantId),
    ]);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    return {
      planId: tenant.subscription?.planId ?? "FREE",
      planDefaults: planLimitsFor(tenant.subscription?.planId),
      overrides: featureLimits?.overrides ?? {},
      effective: await this.resolveEffectiveLimits(tenantId),
    };
  },

  async setOverrides(
    tenantId: string,
    overrides: Partial<PlanLimits>,
    actor: Actor & { platformAdminId: string },
  ) {
    await tenantFeatureLimitsRepository.upsert(tenantId, overrides, actor.platformAdminId);

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.actorId,
      action: "TENANT_LIMITS_UPDATED",
      entityType: "TenantFeatureLimits",
      entityId: tenantId,
      after: { overrides },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return this.getRaw(tenantId);
  },
};
