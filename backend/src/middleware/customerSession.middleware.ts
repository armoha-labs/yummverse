import type { NextFunction, Request, Response } from "express";
import { customerSessionService } from "../services/customerSession.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Verifies the customer session token and attaches tenant/branch/table context from the
 * session record only (§5.3, §56) — never from a client-supplied id. Used by Phase 8's
 * customer-facing order endpoints.
 */
export const requireCustomerSession = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("MISSING_SESSION", "No active session. Please scan the table QR code.");
    }

    const session = await customerSessionService.resolveActiveSession(header.slice("Bearer ".length));
    req.customerSession = {
      sessionId: session._id.toString(),
      tenantId: session.tenantId.toString(),
      branchId: session.branchId.toString(),
      tableId: session.tableId.toString(),
    };
    next();
  },
);
