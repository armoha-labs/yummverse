import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createBranchSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(slugPattern, "Slug must be lowercase, alphanumeric, hyphen-separated."),
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
  contact: z.object({ phone: z.string().optional(), email: z.string().email().optional() }).optional(),
  timezone: z.string().optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: createBranchSchema.shape.address,
  contact: createBranchSchema.shape.contact,
  timezone: z.string().optional(),
  settings: z
    .object({
      tax: z.object({ enabled: z.boolean(), percentage: z.number().min(0).max(100) }).partial().optional(),
      serviceCharge: z
        .object({ enabled: z.boolean(), percentage: z.number().min(0).max(100) })
        .partial()
        .optional(),
      payment: z.object({ allowPayLater: z.boolean(), posCardEnabled: z.boolean() }).partial().optional(),
      ordering: z.object({ kitchenEnabled: z.boolean(), tableStatusEnabled: z.boolean() }).partial().optional(),
    })
    .optional(),
});
