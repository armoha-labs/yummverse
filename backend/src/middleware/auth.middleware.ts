import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";

/** Verifies the access JWT and attaches its payload to request.auth. Trust nothing else. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("MISSING_TOKEN", "Authentication required.");
  }

  try {
    req.auth = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch {
    throw ApiError.unauthorized("INVALID_TOKEN", "Your session has expired. Please sign in again.");
  }
}
