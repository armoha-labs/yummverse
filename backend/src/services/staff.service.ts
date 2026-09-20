import { User, type StaffRole } from "../models/User.js";
import { userRepository } from "../repositories/user.repository.js";
import { branchRepository } from "../repositories/branch.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { generateToken, hashToken } from "../utils/password.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { emailService } from "./email.service.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

const INVITE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days, same as the tenant-admin invite

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole; // restricted to WAITER|KITCHEN at the validator layer (§8A.3)
}

async function buildInviteLink(tenantId: string, email: string, inviteToken: string): Promise<string | undefined> {
  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) return undefined;
  return `${env.FRONTEND_URL}/${tenant.slug}/accept-invite?email=${encodeURIComponent(email)}&token=${inviteToken}`;
}

async function sendInviteEmail(email: string, inviteLink: string | undefined, subject: string, intro: string): Promise<void> {
  if (!inviteLink) return;
  await emailService.send({
    to: email,
    subject,
    text: `${intro}: ${inviteLink}\n\nThis link expires in 7 days.`,
    html: `<p>${intro}:</p><p><a href="${inviteLink}">${inviteLink}</a></p><p>This link expires in 7 days.</p>`,
  });
}

async function issueInvite(userId: string) {
  const inviteToken = generateToken();
  await User.updateOne(
    { _id: userId },
    {
      inviteTokenHash: hashToken(inviteToken),
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
    },
  );
  return inviteToken;
}

export const staffService = {
  // §8A is scoped to Waiter & Kitchen only — the Tenant Admin themselves never appears in
  // this list, regardless of whether a specific role filter was requested.
  listForTenant(tenantId: string, role?: StaffRole) {
    return userRepository.listForTenant(tenantId, role ?? ["WAITER", "KITCHEN"]);
  },

  async create(tenantId: string, input: CreateStaffInput, actor: Actor) {
    const branch = await branchRepository.findDefaultForTenant(tenantId);
    if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");

    const existing = await userRepository.findByTenantAndEmail(tenantId, input.email);
    if (existing) {
      throw ApiError.conflict("EMAIL_TAKEN", `"${input.email}" is already in use at this café.`);
    }

    const user = await userRepository.create({
      tenantId,
      branchId: branch._id.toString(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
    });
    const inviteToken = await issueInvite(user._id.toString());
    const inviteLink = await buildInviteLink(tenantId, user.email, inviteToken);

    logger.info({ tenantId, email: user.email, inviteToken, inviteLink }, "Staff invite link");
    await sendInviteEmail(user.email, inviteLink, "You're invited to join Yummverse", "Set your password to activate your account");

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { user, inviteToken };
  },

  async update(tenantId: string, userId: string, updates: { name?: string; phone?: string }, actor: Actor) {
    const user = await userRepository.findById(tenantId, userId);
    if (!user) throw ApiError.notFound("USER_NOT_FOUND", "Staff member not found.");

    if (updates.name !== undefined) user.name = updates.name;
    if (updates.phone !== undefined) user.phone = updates.phone;
    await user.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return user;
  },

  async setActive(tenantId: string, userId: string, active: boolean, actor: Actor) {
    const user = await userRepository.findById(tenantId, userId);
    if (!user) throw ApiError.notFound("USER_NOT_FOUND", "Staff member not found.");

    // Deactivating never deletes the record — past orders/audit entries reference this
    // user (§8A.2).
    user.active = active;
    await user.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: active ? "USER_ACTIVATED" : "USER_DISABLED",
      entityType: "User",
      entityId: user._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return user;
  },

  async resetPassword(tenantId: string, userId: string, actor: Actor) {
    const user = await userRepository.findById(tenantId, userId);
    if (!user) throw ApiError.notFound("USER_NOT_FOUND", "Staff member not found.");

    user.passwordHash = null;
    await user.save();
    const inviteToken = await issueInvite(user._id.toString());
    const inviteLink = await buildInviteLink(tenantId, user.email, inviteToken);

    logger.info({ tenantId, email: user.email, inviteToken, inviteLink }, "Staff password-reset invite link");
    await sendInviteEmail(user.email, inviteLink, "Reset your Yummverse password", "Set a new password using this link");

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: user._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { inviteToken };
  },
};
