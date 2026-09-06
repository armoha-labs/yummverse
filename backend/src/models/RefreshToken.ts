import { Schema, model, type InferSchemaType, Types } from "mongoose";

export const REFRESH_TOKEN_OWNER_TYPES = ["USER", "PLATFORM_ADMIN"] as const;
export type RefreshTokenOwnerType = (typeof REFRESH_TOKEN_OWNER_TYPES)[number];

const refreshTokenSchema = new Schema(
  {
    ownerType: { type: String, enum: REFRESH_TOKEN_OWNER_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },

    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    revoked: { type: Boolean, default: false },
    replacedByTokenId: { type: Schema.Types.ObjectId, ref: "RefreshToken", default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ ownerType: 1, ownerId: 1, revoked: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: Types.ObjectId;
};
export const RefreshToken = model("RefreshToken", refreshTokenSchema);
