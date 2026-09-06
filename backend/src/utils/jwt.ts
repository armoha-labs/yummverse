import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type StaffRole = "TENANT_ADMIN" | "WAITER" | "KITCHEN";

export type AccessTokenPayload =
  | { sub: string; role: "PLATFORM_ADMIN" }
  | { sub: string; tenantId: string; role: "TENANT_ADMIN" }
  | { sub: string; tenantId: string; branchId: string; role: "WAITER" | "KITCHEN" };

export interface RefreshTokenPayload {
  sub: string;
  role: AccessTokenPayload["role"];
  tokenId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}
