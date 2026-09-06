import { z } from "zod";

export const qrTokenParamSchema = z.object({
  qrToken: z.string().min(1),
});

export const tenantSlugQuerySchema = z.object({
  tenantSlug: z.string().min(1),
});

export const createCustomerSessionSchema = z.object({
  qrToken: z.string().min(1),
});
