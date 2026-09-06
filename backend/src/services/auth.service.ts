import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Tenant } from "../models/Tenant.js";
import { PlatformAdmin } from "../models/PlatformAdmin.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { userRepository } from "../repositories/user.repository.js";
import { resolveTenantBySlug } from "../tenant/context.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword, verifyPassword, hashToken } from "../utils/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenPayload,
} from "../utils/jwt.js";
import { env } from "../config/env.js";

function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 1000 * 60 * 15;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return value * unitMs;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(
  ownerType: "USER" | "PLATFORM_ADMIN",
  ownerId: Types.ObjectId,
  accessPayload: AccessTokenPayload,
): Promise<TokenPair> {
  const accessToken = signAccessToken(accessPayload);

  const record = await RefreshToken.create({
    ownerType,
    ownerId,
    tokenHash: "pending",
    expiresAt: new Date(Date.now() + parseTtlToMs(env.REFRESH_TOKEN_TTL)),
  });

  const refreshToken = signRefreshToken({
    sub: ownerId.toString(),
    role: accessPayload.role,
    tokenId: record._id.toString(),
  });
  record.tokenHash = hashToken(refreshToken);
  await record.save();

  return { accessToken, refreshToken };
}

export const authService = {
  /** Staff login (§32, §33) — tenant is resolved from the slug before any credential check. */
  async loginStaff(tenantSlug: string, email: string, password: string): Promise<TokenPair> {
    const tenant = await resolveTenantBySlug(tenantSlug);
    if (tenant.status === "SUSPENDED" || tenant.status === "CANCELLED") {
      throw ApiError.forbidden("TENANT_UNAVAILABLE", "This café is temporarily unavailable.");
    }

    const user = await userRepository.findByTenantAndEmail(tenant._id, email);

    if (!user || !user.passwordHash || !user.active) {
      throw ApiError.unauthorized("INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw ApiError.unauthorized("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessPayload: AccessTokenPayload =
      user.role === "TENANT_ADMIN"
        ? { sub: user._id.toString(), tenantId: tenant._id.toString(), role: "TENANT_ADMIN" }
        : {
            sub: user._id.toString(),
            tenantId: tenant._id.toString(),
            branchId: (user.branchId as Types.ObjectId).toString(),
            role: user.role as "WAITER" | "KITCHEN",
          };

    return issueTokenPair("USER", user._id, accessPayload);
  },

  async loginPlatformAdmin(email: string, password: string): Promise<TokenPair> {
    const admin = await PlatformAdmin.findOne({ email: email.toLowerCase() });
    if (!admin || !admin.active) {
      throw ApiError.unauthorized("INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const valid = await verifyPassword(admin.passwordHash, password);
    if (!valid) {
      throw ApiError.unauthorized("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    return issueTokenPair("PLATFORM_ADMIN", admin._id, {
      sub: admin._id.toString(),
      role: "PLATFORM_ADMIN",
    });
  },

  /** Completes a staff invite (§8A.2) by setting the initial password. */
  async acceptInvite(tenantSlug: string, email: string, inviteToken: string, newPassword: string) {
    const tenant = await resolveTenantBySlug(tenantSlug);
    const user = await userRepository.findByTenantAndEmail(tenant._id, email);

    if (
      !user ||
      !user.inviteTokenHash ||
      !user.inviteTokenExpiresAt ||
      user.inviteTokenExpiresAt < new Date() ||
      user.inviteTokenHash !== hashToken(inviteToken)
    ) {
      throw ApiError.badRequest("INVALID_INVITE", "This invite link is invalid or has expired.");
    }

    user.passwordHash = await hashPassword(newPassword);
    user.inviteTokenHash = null;
    user.inviteTokenExpiresAt = null;
    await user.save();

    return user;
  },

  /** Rotates a refresh token. Reuse of an already-rotated/revoked token revokes the chain. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
    }

    const record = await RefreshToken.findById(payload.tokenId);
    if (!record || record.tokenHash !== hashToken(refreshToken)) {
      throw ApiError.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
    }

    if (record.revoked) {
      // Token reuse detected — revoke every token issued after this one for this owner.
      await RefreshToken.updateMany(
        { ownerType: record.ownerType, ownerId: record.ownerId, revoked: false },
        { revoked: true },
      );
      throw ApiError.unauthorized(
        "REFRESH_TOKEN_REUSED",
        "This session was revoked for your security. Please sign in again.",
      );
    }

    if (record.expiresAt < new Date()) {
      throw ApiError.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
    }

    let accessPayload: AccessTokenPayload;
    if (payload.role === "PLATFORM_ADMIN") {
      const admin = await PlatformAdmin.findById(record.ownerId);
      if (!admin || !admin.active) {
        throw ApiError.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
      }
      accessPayload = { sub: admin._id.toString(), role: "PLATFORM_ADMIN" };
    } else {
      const user = await User.findById(record.ownerId);
      if (!user || !user.active) {
        throw ApiError.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
      }
      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "CANCELLED") {
        throw ApiError.forbidden("TENANT_UNAVAILABLE", "This café is temporarily unavailable.");
      }
      accessPayload =
        user.role === "TENANT_ADMIN"
          ? { sub: user._id.toString(), tenantId: user.tenantId.toString(), role: "TENANT_ADMIN" }
          : {
              sub: user._id.toString(),
              tenantId: user.tenantId.toString(),
              branchId: (user.branchId as Types.ObjectId).toString(),
              role: user.role as "WAITER" | "KITCHEN",
            };
    }

    const next = await issueTokenPair(record.ownerType, record.ownerId, accessPayload);

    record.revoked = true;
    await record.save();
    await RefreshToken.updateOne(
      { tokenHash: hashToken(next.refreshToken) },
      { replacedByTokenId: record._id },
    );

    return next;
  },

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await RefreshToken.findByIdAndUpdate(payload.tokenId, { revoked: true });
    } catch {
      // Already invalid/expired — logging out is a no-op in that case.
    }
  },
};
