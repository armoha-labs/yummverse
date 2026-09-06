import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const STAFF_ROLES = ["TENANT_ADMIN", "WAITER", "KITCHEN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const userSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    // required for WAITER/KITCHEN (§6A.5); omitted for TENANT_ADMIN, who spans all branches
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },

    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String },

    // null until the invited staff member sets their password (§8A.2)
    passwordHash: { type: String, default: null },
    inviteTokenHash: { type: String, default: null },
    inviteTokenExpiresAt: { type: Date, default: null },

    role: { type: String, enum: STAFF_ROLES, required: true },

    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, branchId: 1, role: 1 });

// Belt-and-suspenders: these fields must never reach an API response (§52), regardless of
// which endpoint returns a User document — not just the ones that remember to .select() them out.
userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.inviteTokenHash;
    delete ret.inviteTokenExpiresAt;
    return ret;
  },
});

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model("User", userSchema);
