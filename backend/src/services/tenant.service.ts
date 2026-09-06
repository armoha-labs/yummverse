import { Types } from "mongoose";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { branchRepository } from "../repositories/branch.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { tenantSettingsRepository } from "../repositories/tenantSettings.repository.js";
import { auditService } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { generateToken, hashToken } from "../utils/password.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { emailService } from "./email.service.js";
import { getStorageProvider, type UploadedFile } from "../storage/index.js";
import type { TenantStatus, TenantDocument } from "../models/Tenant.js";
import type { AuditContext } from "./audit.service.js";
import type { PlanId } from "../config/plans.js";

type TenantActor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

const INVITE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function buildInviteLink(tenantSlug: string, email: string, inviteToken: string): string {
  return `${env.FRONTEND_URL}/${tenantSlug}/accept-invite?email=${encodeURIComponent(email)}&token=${inviteToken}`;
}

async function sendInviteEmail(tenantName: string, email: string, inviteLink: string): Promise<void> {
  await emailService.send({
    to: email,
    subject: `You're invited to manage ${tenantName} on Yummverse`,
    text: `You've been invited as the admin for ${tenantName}. Set your password to activate your account: ${inviteLink}\n\nThis link expires in 7 days.`,
    html: `<p>You've been invited as the admin for <strong>${tenantName}</strong>.</p><p><a href="${inviteLink}">Set your password to activate your account</a></p><p>This link expires in 7 days.</p>`,
  });
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  contact?: { phone?: string; email?: string };
  adminName: string;
  adminEmail: string;
  planId?: string;
}

export interface CreateTenantResult {
  tenant: Awaited<ReturnType<typeof tenantRepository.create>>;
  branch: Awaited<ReturnType<typeof branchRepository.createDefault>>;
  admin: Awaited<ReturnType<typeof userRepository.create>>;
  inviteToken: string;
  inviteLink: string;
}

export const tenantService = {
  async createTenant(
    input: CreateTenantInput,
    actor: { platformAdminId: string; ipAddress?: string; userAgent?: string },
  ): Promise<CreateTenantResult> {
    const existing = await tenantRepository.findBySlug(input.slug);
    if (existing) {
      throw ApiError.conflict("TENANT_SLUG_TAKEN", `Slug "${input.slug}" is already in use.`);
    }

    const tenant = await tenantRepository.create({
      name: input.name,
      slug: input.slug,
      contact: input.contact,
      planId: input.planId,
    });

    const branch = await branchRepository.createDefault(tenant._id as Types.ObjectId);
    await tenantSettingsRepository.createDefault(tenant._id as Types.ObjectId, {
      currency: tenant.currency,
      timezone: tenant.timezone,
    });

    const inviteToken = generateToken();
    const admin = await userRepository.create({
      tenantId: tenant._id as Types.ObjectId,
      name: input.adminName,
      email: input.adminEmail,
      role: "TENANT_ADMIN",
    });
    admin.inviteTokenHash = hashToken(inviteToken);
    admin.inviteTokenExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    await admin.save();

    // Falls back to logging the set-password link when no SMTP provider is configured
    // (§54), so the flow stays usable end-to-end in development.
    const inviteLink = buildInviteLink(tenant.slug, admin.email, inviteToken);
    logger.info({ tenantSlug: tenant.slug, adminEmail: admin.email, inviteToken, inviteLink }, "Tenant admin invite link");
    await sendInviteEmail(tenant.name, admin.email, inviteLink);

    await auditService.record({
      tenantId: tenant._id as Types.ObjectId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.platformAdminId,
      action: "TENANT_CREATED",
      entityType: "Tenant",
      entityId: tenant._id as Types.ObjectId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    await auditService.record({
      tenantId: tenant._id as Types.ObjectId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.platformAdminId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: admin._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { tenant, branch, admin, inviteToken, inviteLink };
  },

  /** Resends the tenant admin invite email — also doubles as a way to hand the tenant admin
   * a fresh set-password link if they're already active but locked out, since accept-invite always
   * overwrites whatever password exists. */
  async resendAdminInvite(tenantId: string, actor: { platformAdminId: string; ipAddress?: string; userAgent?: string }) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    const admin = await userRepository.findTenantAdmin(tenantId);
    if (!admin) throw ApiError.notFound("TENANT_ADMIN_NOT_FOUND", "This tenant has no admin user.");

    const inviteToken = generateToken();
    admin.inviteTokenHash = hashToken(inviteToken);
    admin.inviteTokenExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
    await admin.save();

    const inviteLink = buildInviteLink(tenant.slug, admin.email, inviteToken);
    logger.info({ tenantSlug: tenant.slug, adminEmail: admin.email, inviteToken, inviteLink }, "Tenant admin invite link (resent)");
    await sendInviteEmail(tenant.name, admin.email, inviteLink);

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.platformAdminId,
      action: "TENANT_ADMIN_INVITE_RESENT",
      entityType: "User",
      entityId: admin._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { email: admin.email, inviteLink };
  },

  async setStatus(
    tenantId: string,
    status: TenantStatus,
    action: "TENANT_ACTIVATED" | "TENANT_SUSPENDED" | "TENANT_CANCELLED",
    actor: { platformAdminId: string; ipAddress?: string; userAgent?: string },
  ) {
    const tenant = await tenantRepository.setStatus(tenantId, status);
    if (!tenant) {
      throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");
    }

    await auditService.record({
      tenantId: tenant._id as Types.ObjectId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.platformAdminId,
      action,
      entityType: "Tenant",
      entityId: tenant._id as Types.ObjectId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tenant;
  },

  listTenants() {
    return tenantRepository.list();
  },

  /** Platform Admin subscription/plan management (§47) — distinct from the tenant's own
   * profile edits (TENANT_PROFILE_UPDATED is specifically for those, §53). */
  async updateSubscription(
    tenantId: string,
    updates: { planId?: PlanId; status?: string; endDate?: Date; trialEndsAt?: Date },
    actor: { platformAdminId: string; ipAddress?: string; userAgent?: string },
  ) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    tenant.subscription = { ...(tenant.subscription ?? { planId: "FREE" as PlanId }), ...updates };
    await tenant.save();

    await auditService.record({
      tenantId,
      actorType: "PLATFORM_ADMIN",
      actorId: actor.platformAdminId,
      action: "TENANT_SUBSCRIPTION_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tenant;
  },

  async updateProfile(
    tenantId: string,
    updates: {
      name?: string;
      contact?: { phone?: string; email?: string };
      address?: TenantDocument["address"];
    },
    actor: TenantActor,
  ) {
    const before = await tenantRepository.findById(tenantId);
    if (!before) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    if (updates.name !== undefined) before.name = updates.name;
    if (updates.contact) Object.assign(before.contact ?? {}, updates.contact);
    if (updates.address) Object.assign(before.address ?? {}, updates.address);
    await before.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TENANT_PROFILE_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return before;
  },

  async updateBranding(
    tenantId: string,
    updates: { primaryColor?: string; secondaryColor?: string },
    actor: TenantActor,
  ) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    tenant.branding ??= {};
    Object.assign(tenant.branding, updates);
    await tenant.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TENANT_BRANDING_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tenant;
  },

  async uploadLogo(tenantId: string, kind: "logo" | "favicon", file: UploadedFile, actor: TenantActor) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    const storage = getStorageProvider();
    const previousAssetId = kind === "logo" ? tenant.branding?.logoAssetId : undefined;

    const asset = await storage.upload(`tenants/${tenantId}/branding`, file);

    tenant.branding ??= {};
    if (kind === "logo") {
      tenant.branding.logoUrl = asset.url;
      tenant.branding.logoAssetId = asset.assetId;
    } else {
      tenant.branding.faviconUrl = asset.url;
    }
    await tenant.save();

    if (previousAssetId) {
      await storage.delete(previousAssetId).catch((err: unknown) => {
        logger.warn({ err, previousAssetId }, "Failed to delete replaced branding asset");
      });
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TENANT_BRANDING_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tenant;
  },

  async removeLogo(tenantId: string, actor: TenantActor) {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND", "Tenant not found.");

    const assetId = tenant.branding?.logoAssetId;
    if (tenant.branding) {
      tenant.branding.logoUrl = undefined;
      tenant.branding.logoAssetId = undefined;
    }
    await tenant.save();

    if (assetId) {
      await getStorageProvider()
        .delete(assetId)
        .catch((err: unknown) => {
          logger.warn({ err, assetId }, "Failed to delete removed branding asset");
        });
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TENANT_BRANDING_UPDATED",
      entityType: "Tenant",
      entityId: tenantId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tenant;
  },
};
