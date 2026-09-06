import { z } from "zod";

export const staffLoginSchema = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const acceptInviteSchema = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  inviteToken: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});
