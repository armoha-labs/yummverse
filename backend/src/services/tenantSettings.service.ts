import { tenantSettingsRepository } from "../repositories/tenantSettings.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import type { z } from "zod";
import type { updateSettingsSchema } from "../validators/tenant.validators.js";

type SettingsActor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };
type SettingsUpdate = z.infer<typeof updateSettingsSchema>;

function deepMerge<T extends Record<string, unknown>>(target: T, patch: Partial<T>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const targetSlot = (target as Record<string, unknown>)[key];
      if (targetSlot && typeof targetSlot === "object") {
        deepMerge(targetSlot as Record<string, unknown>, value as Record<string, unknown>);
        continue;
      }
    }
    (target as Record<string, unknown>)[key] = value;
  }
}

export const tenantSettingsService = {
  async getOrCreate(tenantId: string) {
    const existing = await tenantSettingsRepository.findByTenant(tenantId);
    if (existing) return existing;
    return tenantSettingsRepository.createDefault(tenantId);
  },

  async update(tenantId: string, updates: SettingsUpdate, actor: SettingsActor) {
    const settings = await this.getOrCreate(tenantId);
    if (!settings) throw ApiError.notFound("SETTINGS_NOT_FOUND", "Tenant settings not found.");

    deepMerge(settings as unknown as Record<string, unknown>, updates as Record<string, unknown>);
    await settings.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TENANT_SETTINGS_UPDATED",
      entityType: "TenantSettings",
      entityId: settings._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return settings;
  },
};
