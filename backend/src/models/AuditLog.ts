import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const AUDIT_ACTOR_TYPES = ["PLATFORM_ADMIN", "USER", "SYSTEM"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

const auditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },

    actorType: { type: String, enum: AUDIT_ACTOR_TYPES, required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },

    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },

    // Never populated for payment settings changes (§53) — the event's existence is the trail.
    before: { type: Schema.Types.Mixed, default: undefined },
    after: { type: Schema.Types.Mixed, default: undefined },

    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema> & { _id: Types.ObjectId };
export const AuditLog = model("AuditLog", auditLogSchema);
