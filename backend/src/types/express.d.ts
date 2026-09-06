import type { AccessTokenPayload } from "../utils/jwt.js";

export interface CustomerSessionContext {
  sessionId: string;
  tenantId: string;
  branchId: string;
  tableId: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      tenantId?: string;
      branchId?: string;
      customerSession?: CustomerSessionContext;
    }
  }
}

export {};
