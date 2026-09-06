import { AuditLog, type AuditActorType } from "../models/AuditLog.js";
import { Types } from "mongoose";

export interface AuditContext {
  tenantId: string | Types.ObjectId;
  actorType: AuditActorType;
  actorId: string | Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordAuditInput extends AuditContext {
  action: string;
  entityType: string;
  entityId: string | Types.ObjectId;
  before?: unknown;
  after?: unknown;
}

// Payment-settings events must never carry a before/after snapshot (§53) — enforced here,
// not left to each call site to remember.
const NO_SNAPSHOT_ACTIONS = new Set(["PAYMENT_SETTINGS_UPDATED", "PAYMENT_PROVIDER_CHANGED"]);

export const auditService = {
  record(input: RecordAuditInput) {
    const snapshotAllowed = !NO_SNAPSHOT_ACTIONS.has(input.action);
    return AuditLog.create({
      tenantId: input.tenantId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: snapshotAllowed ? input.before : undefined,
      after: snapshotAllowed ? input.after : undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  },
};
