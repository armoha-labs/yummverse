import type { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { User } from "../models/User.js";
import { PlatformAdmin } from "../models/PlatformAdmin.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  staffLoginSchema,
  platformLoginSchema,
  refreshSchema,
  acceptInviteSchema,
} from "../validators/auth.validators.js";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug, email, password } = staffLoginSchema.parse(req.body);
  const tokens = await authService.loginStaff(tenantSlug, email, password);
  sendSuccess(res, tokens);
});

export const platformLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = platformLoginSchema.parse(req.body);
  const tokens = await authService.loginPlatformAdmin(email, password);
  sendSuccess(res, tokens);
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug, email, inviteToken, newPassword } = acceptInviteSchema.parse(req.body);
  await authService.acceptInvite(tenantSlug, email, inviteToken, newPassword);
  sendSuccess(res, { message: "Password set. You can now sign in." });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken);
  sendSuccess(res, tokens);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  sendSuccess(res, { message: "Logged out." });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) {
    throw ApiError.unauthorized("MISSING_TOKEN");
  }

  if (req.auth.role === "PLATFORM_ADMIN") {
    const admin = await PlatformAdmin.findById(req.auth.sub).select("-passwordHash");
    if (!admin) throw ApiError.notFound("NOT_FOUND", "Account not found.");
    sendSuccess(res, { id: admin._id, name: admin.name, email: admin.email, role: "PLATFORM_ADMIN" });
    return;
  }

  const user = await User.findOne({ _id: req.auth.sub, tenantId: req.auth.tenantId }).select(
    "-passwordHash -inviteTokenHash",
  );
  if (!user) throw ApiError.notFound("NOT_FOUND", "Account not found.");
  sendSuccess(res, {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
  });
});
