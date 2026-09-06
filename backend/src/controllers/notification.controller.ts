import type { Request, Response } from "express";
import { deviceTokenRepository } from "../repositories/deviceToken.repository.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { customerSessionService } from "../services/customerSession.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { registerTokenSchema, deregisterTokenSchema } from "../validators/notification.validators.js";

/**
 * Works for either bearer type — staff JWT or customer session token (§40A.3) — since a
 * single client-facing "register my device" call shouldn't need to know which one it holds.
 * tenantId/branchId always come from the verified credential, never the request body.
 */
async function resolveRegistrant(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("MISSING_TOKEN", "Authentication required.");
  }
  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    if (payload.role === "PLATFORM_ADMIN") {
      throw ApiError.forbidden("NOT_APPLICABLE", "Platform Admin has no device registration.");
    }
    return {
      tenantId: payload.tenantId,
      branchId: payload.role === "TENANT_ADMIN" ? undefined : payload.branchId,
      ownerType: "USER" as const,
      ownerId: payload.sub,
    };
  } catch {
    const session = await customerSessionService.resolveActiveSession(token);
    return {
      tenantId: session.tenantId.toString(),
      branchId: session.branchId.toString(),
      ownerType: "CUSTOMER_SESSION" as const,
      ownerId: session._id.toString(),
    };
  }
}

export const registerToken = asyncHandler(async (req: Request, res: Response) => {
  const registrant = await resolveRegistrant(req);
  const { platform, fcmToken } = registerTokenSchema.parse(req.body);

  await deviceTokenRepository.register({ ...registrant, platform, fcmToken });
  sendSuccess(res, { message: "Device registered." });
});

export const deregisterToken = asyncHandler(async (req: Request, res: Response) => {
  await resolveRegistrant(req); // still verifies the caller owns a valid credential
  const { fcmToken } = deregisterTokenSchema.parse(req.body);

  await deviceTokenRepository.deregister(fcmToken);
  sendSuccess(res, { message: "Device deregistered." });
});
