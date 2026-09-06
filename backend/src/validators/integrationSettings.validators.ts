import { z } from "zod";
import { INTEGRATION_PROVIDERS } from "../models/TenantIntegrationSettings.js";

export const providerParamSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
});

export const upsertIntegrationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  outletId: z.string().optional(),
  apiKey: z.string().optional(),
});
