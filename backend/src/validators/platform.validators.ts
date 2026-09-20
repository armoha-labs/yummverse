import { z } from "zod";
import { PLAN_IDS } from "../config/plans.js";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const tenantIdParamSchema = z.object({
  id: z.string().min(1),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1),
  invoiceId: z.string().min(1),
});

export const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(slugPattern, "Slug must be lowercase, alphanumeric, hyphen-separated."),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  adminName: z.string().min(1),
  adminEmail: z.string().email(),
  planId: z.enum(PLAN_IDS).optional(),
});

export const updateSubscriptionSchema = z.object({
  planId: z.enum(PLAN_IDS).optional(),
  status: z.string().optional(),
  endDate: z.coerce.date().optional(),
  trialEndsAt: z.coerce.date().optional(),
});

const limitOverridesSchema = z
  .object({
    maxTables: z.number().min(0).optional(),
    maxStaffUsers: z.number().min(0).optional(),
    maxOrdersPerMonth: z.number().min(0).optional(),
    advancedReports: z.boolean().optional(),
    customBranding: z.boolean().optional(),
    allowedPaymentProviders: z.array(z.string()).optional(),
    paymentGatewayEnabled: z.boolean().optional(),
    thermalPrintingEnabled: z.boolean().optional(),
    eInvoiceWhatsappEnabled: z.boolean().optional(),
    firebasePushEnabled: z.boolean().optional(),
    swiggyIntegrationEnabled: z.boolean().optional(),
    zomatoIntegrationEnabled: z.boolean().optional(),
  })
  .partial();

export const updateLimitsSchema = z.object({
  overrides: limitOverridesSchema,
});
