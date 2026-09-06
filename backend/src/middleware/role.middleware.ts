import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import type { AccessTokenPayload } from "../utils/jwt.js";

export function requireRole(...roles: AccessTokenPayload["role"][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw ApiError.forbidden("FORBIDDEN", "You do not have access to this resource.");
    }
    next();
  };
}
