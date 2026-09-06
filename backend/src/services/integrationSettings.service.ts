import { tenantIntegrationSettingsRepository } from "../repositories/tenantIntegrationSettings.repository.js";
import { tenantLimitsService } from "./tenantLimits.service.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { encrypt } from "../utils/encryption.js";
import { INTEGRATION_PROVIDERS, type IntegrationProviderName } from "../models/TenantIntegrationSettings.js";
import type { PlanLimits } from "../config/plans.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export interface UpsertIntegrationSettingsInput {
  enabled?: boolean;
  outletId?: string;
  apiKey?: string; // plaintext in, encrypted at rest — never returned
}

// Which plan-level flag (§7A) gates each aggregator — Platform Admin controls this;
// the café only controls its own `enabled` toggle and credentials underneath it.
const PLAN_FLAG_FOR_PROVIDER: Record<IntegrationProviderName, keyof PlanLimits> = {
  SWIGGY: "swiggyIntegrationEnabled",
  ZOMATO: "zomatoIntegrationEnabled",
};

function toClientShape(
  provider: IntegrationProviderName,
  planEnabled: boolean,
  doc: Awaited<ReturnType<typeof tenantIntegrationSettingsRepository.findOne>> | null,
) {
  return {
    provider,
    planEnabled,
    enabled: doc?.enabled ?? false,
    outletId: doc?.outletId ?? null,
    hasApiKey: Boolean(doc?.apiKeyEncrypted),
    updatedAt: doc?.updatedAt ?? null,
  };
}

export const integrationSettingsService = {
  async list(tenantId: string) {
    const [limits, rows] = await Promise.all([
      tenantLimitsService.resolveEffectiveLimits(tenantId),
      tenantIntegrationSettingsRepository.listForTenant(tenantId),
    ]);

    return INTEGRATION_PROVIDERS.map((provider) => {
      const doc = rows.find((r) => r.provider === provider) ?? null;
      return toClientShape(provider, limits[PLAN_FLAG_FOR_PROVIDER[provider]] as boolean, doc);
    });
  },

  async upsert(tenantId: string, provider: IntegrationProviderName, input: UpsertIntegrationSettingsInput, actor: Actor) {
    const limits = await tenantLimitsService.resolveEffectiveLimits(tenantId);
    const planEnabled = limits[PLAN_FLAG_FOR_PROVIDER[provider]] as boolean;
    if (input.enabled && !planEnabled) {
      throw ApiError.badRequest(
        "INTEGRATION_DISABLED_BY_PLAN",
        `${provider[0]}${provider.slice(1).toLowerCase()} integration is not available on this café's current plan.`,
      );
    }

    const doc = await tenantIntegrationSettingsRepository.upsert(tenantId, provider, {
      enabled: input.enabled,
      outletId: input.outletId,
      apiKeyEncrypted: input.apiKey !== undefined ? encrypt(input.apiKey) : undefined,
    });

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "INTEGRATION_SETTINGS_UPDATED",
      entityType: "TenantIntegrationSettings",
      entityId: doc._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toClientShape(provider, planEnabled, doc);
  },
};
