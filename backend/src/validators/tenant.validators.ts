import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
});

export const updateSettingsSchema = z.object({
  currency: z.string().optional(),
  timezone: z.string().optional(),
  tax: z.object({ enabled: z.boolean(), percentage: z.number().min(0).max(100) }).partial().optional(),
  serviceCharge: z
    .object({ enabled: z.boolean(), percentage: z.number().min(0).max(100) })
    .partial()
    .optional(),
  ordering: z
    .object({
      enabled: z.boolean(),
      allowMultipleOrdersPerTable: z.boolean(),
      collectCustomerPhone: z.boolean(),
    })
    .partial()
    .optional(),
  notifications: z
    .object({ soundEnabled: z.boolean(), browserPushEnabled: z.boolean() })
    .partial()
    .optional(),
  payment: z.object({ allowPayLater: z.boolean(), posCardEnabled: z.boolean() }).partial().optional(),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color, e.g. #4B2E2B.");

export const updateBrandingSchema = z.object({
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
});
