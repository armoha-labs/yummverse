import { Schema, model, type InferSchemaType, Types } from "mongoose";

const platformAdminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Belt-and-suspenders, same rationale as User (§52): never let passwordHash leak via JSON.
platformAdminSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    return ret;
  },
});

export type PlatformAdminDocument = InferSchemaType<typeof platformAdminSchema> & {
  _id: Types.ObjectId;
};
export const PlatformAdmin = model("PlatformAdmin", platformAdminSchema);
