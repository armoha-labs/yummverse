import { tenantPaymentSettingsRepository } from "../repositories/tenantPaymentSettings.repository.js";
import { branchRepository } from "../repositories/branch.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { PaymentProviderFactory } from "../payment/PaymentProviderFactory.js";
import type { PaymentProviderName } from "../models/TenantPaymentSettings.js";
import type { TestConnectionResult } from "../payment/PaymentProvider.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export interface UpsertPaymentSettingsInput {
  provider: PaymentProviderName;
  currency?: string;
  enabled?: boolean;
  testMode?: boolean;
  keyId?: string;
  keySecret?: string; // plaintext in, encrypted at rest — never returned
  webhookSecret?: string;
}

/** Never include secret values — only whether one is set (§16, §52). */
function toClientShape(doc: NonNullable<Awaited<ReturnType<typeof tenantPaymentSettingsRepository.findExact>>>) {
  return {
    id: doc._id,
    tenantId: doc.tenantId,
    branchId: doc.branchId ?? null,
    provider: doc.provider,
    currency: doc.currency,
    enabled: doc.enabled,
    testMode: doc.testMode,
    keyId: doc.credentials?.keyId ?? null,
    hasKeySecret: Boolean(doc.credentials?.keySecretEncrypted),
    hasWebhookSecret: Boolean(doc.credentials?.webhookSecretEncrypted),
    updatedAt: doc.updatedAt,
  };
}

async function assertBranchBelongsToTenant(tenantId: string, branchId: string) {
  const branch = await branchRepository.findById(tenantId, branchId);
  if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");
}

export const paymentSettingsService = {
  async getResolved(tenantId: string, branchId?: string) {
    if (branchId) await assertBranchBelongsToTenant(tenantId, branchId);

    const resolved = await tenantPaymentSettingsRepository.findResolved(tenantId, branchId);
    if (!resolved) return null;

    const isOverride = branchId ? String(resolved.branchId) === String(branchId) : true;
    return { ...toClientShape(resolved), isOverride };
  },

  async upsert(tenantId: string, branchId: string | undefined, input: UpsertPaymentSettingsInput, actor: Actor) {
    if (branchId) await assertBranchBelongsToTenant(tenantId, branchId);

    const { doc, providerChanged } = await tenantPaymentSettingsRepository.upsert(tenantId, branchId, {
      provider: input.provider,
      currency: input.currency,
      enabled: input.enabled,
      testMode: input.testMode,
      keyId: input.keyId,
      keySecretEncrypted: input.keySecret !== undefined ? encrypt(input.keySecret) : undefined,
      webhookSecretEncrypted:
        input.webhookSecret !== undefined ? encrypt(input.webhookSecret) : undefined,
    });

    // §53: these two actions never carry a before/after snapshot — auditService enforces
    // that centrally, so passing `after` here is safe even though it's discarded.
    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: providerChanged ? "PAYMENT_PROVIDER_CHANGED" : "PAYMENT_SETTINGS_UPDATED",
      entityType: "TenantPaymentSettings",
      entityId: doc._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return toClientShape(doc);
  },

  async clearOverride(tenantId: string, branchId: string, actor: Actor) {
    await assertBranchBelongsToTenant(tenantId, branchId);
    const deleted = await tenantPaymentSettingsRepository.deleteOverride(tenantId, branchId);
    if (!deleted) {
      throw ApiError.notFound("NO_OVERRIDE", "This branch has no override to clear.");
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "PAYMENT_SETTINGS_UPDATED",
      entityType: "TenantPaymentSettings",
      entityId: deleted._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  },

  async testConnection(
    tenantId: string,
    branchId: string | undefined,
    override?: { provider?: PaymentProviderName; keyId?: string; keySecret?: string },
  ): Promise<TestConnectionResult> {
    if (branchId) await assertBranchBelongsToTenant(tenantId, branchId);

    const settings = await tenantPaymentSettingsRepository.findResolved(tenantId, branchId);

    // Tests whatever the admin currently has in the form, not only what's already saved —
    // otherwise "Test Connection" only ever validates a *previous* save, which is exactly
    // backwards (it should be how you check credentials are right *before* saving them).
    // Falls back to the saved value per-field, the same "leave blank to keep" convention the
    // Save action itself uses, so re-testing after changing just the currency (say) still
    // works without retyping a secret that hasn't changed.
    const keyId = override?.keyId || settings?.credentials?.keyId;
    const keySecret =
      override?.keySecret ||
      (settings?.credentials?.keySecretEncrypted ? decrypt(settings.credentials.keySecretEncrypted) : undefined);
    const provider = override?.provider ?? (settings?.provider as PaymentProviderName | undefined) ?? "RAZORPAY";

    if (!keyId || !keySecret) {
      return { ok: false, message: "Enter a Key ID and Key Secret to test the connection." };
    }

    const providerImpl = PaymentProviderFactory.getProvider(provider);
    return providerImpl.testConnection({ keyId, keySecret });
  },

  /** Pre-fills a form from another branch's settings — never copies the secret itself (§16). */
  async copyFields(tenantId: string, fromBranchId: string | undefined, toBranchId: string) {
    await assertBranchBelongsToTenant(tenantId, toBranchId);
    if (fromBranchId) await assertBranchBelongsToTenant(tenantId, fromBranchId);

    const source = await tenantPaymentSettingsRepository.findResolved(tenantId, fromBranchId);
    if (!source) {
      throw ApiError.notFound("SOURCE_NOT_FOUND", "The source branch has no payment settings to copy.");
    }

    return {
      provider: source.provider,
      currency: source.currency,
      testMode: source.testMode,
      keyId: source.credentials?.keyId ?? null,
    };
  },
};
