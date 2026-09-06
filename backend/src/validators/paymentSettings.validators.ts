import { z } from "zod";
import { PAYMENT_PROVIDERS } from "../models/TenantPaymentSettings.js";

export const branchIdQuerySchema = z.object({
  branchId: z.string().optional(),
});

export const upsertPaymentSettingsSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  currency: z.string().optional(),
  enabled: z.boolean().optional(),
  testMode: z.boolean().optional(),
  keyId: z.string().optional(),
  keySecret: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export const copyPaymentSettingsSchema = z.object({
  fromBranchId: z.string().optional(),
  toBranchId: z.string().min(1),
});
