import { z } from "zod";

export const registerTokenSchema = z.object({
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
  fcmToken: z.string().min(1),
});

export const deregisterTokenSchema = z.object({
  fcmToken: z.string().min(1),
});
