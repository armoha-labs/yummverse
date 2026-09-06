import type { Request, Response } from "express";
import { tenantService } from "../services/tenant.service.js";
import { tenantLimitsService } from "../services/tenantLimits.service.js";
import { platformMetricsService } from "../services/platformMetrics.service.js";
import { subscriptionBillingService } from "../services/subscriptionBilling.service.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createTenantSchema,
  tenantIdParamSchema,
  invoiceIdParamSchema,
  updateSubscriptionSchema,
  updateLimitsSchema,
} from "../validators/platform.validators.js";

function requirePlatformAdmin(req: Request): string {
  if (!req.auth || req.auth.role !== "PLATFORM_ADMIN") {
    throw ApiError.forbidden("FORBIDDEN");
  }
  return req.auth.sub;
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const createTenant = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const input = createTenantSchema.parse(req.body);

  const result = await tenantService.createTenant(input, { platformAdminId, ...actorMeta(req) });

  sendSuccess(
    res,
    {
      tenant: result.tenant,
      branch: result.branch,
      admin: { id: result.admin._id, email: result.admin.email, inviteLink: result.inviteLink },
    },
    201,
  );
});

export const listTenants = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const tenants = await tenantService.listTenants();
  sendSuccess(res, tenants);
});

export const getTenant = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await tenantRepository.findById(id);
  if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND");

  const adminUser = await userRepository.findTenantAdmin(id);
  const admin = adminUser
    ? { id: adminUser._id, email: adminUser.email, hasPassword: Boolean(adminUser.passwordHash) }
    : null;

  sendSuccess(res, { ...tenant.toObject(), admin });
});

export const resendAdminInvite = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const result = await tenantService.resendAdminInvite(id, { platformAdminId, ...actorMeta(req) });
  sendSuccess(res, result);
});

export const activateTenant = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await tenantService.setStatus(id, "ACTIVE", "TENANT_ACTIVATED", {
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, tenant);
});

export const suspendTenant = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await tenantService.setStatus(id, "SUSPENDED", "TENANT_SUSPENDED", {
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, tenant);
});

export const cancelTenant = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const tenant = await tenantService.setStatus(id, "CANCELLED", "TENANT_CANCELLED", {
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, tenant);
});

export const updateSubscription = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const updates = updateSubscriptionSchema.parse(req.body);
  const tenant = await tenantService.updateSubscription(id, updates, { platformAdminId, ...actorMeta(req) });
  sendSuccess(res, tenant);
});

export const getLimits = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  sendSuccess(res, await tenantLimitsService.getRaw(id));
});

export const getPlatformMetrics = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  sendSuccess(res, await platformMetricsService.summary());
});

export const updateLimits = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const { overrides } = updateLimitsSchema.parse(req.body);
  const result = await tenantLimitsService.setOverrides(id, overrides, {
    actorId: platformAdminId,
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, result);
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  sendSuccess(res, await subscriptionBillingService.listInvoices(id));
});

export const generateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id } = tenantIdParamSchema.parse(req.params);
  const invoice = await subscriptionBillingService.generateInvoice(id, {
    actorId: platformAdminId,
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, invoice, 201);
});

export const sendInvoice = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id, invoiceId } = invoiceIdParamSchema.parse(req.params);
  const invoice = await subscriptionBillingService.sendInvoice(id, invoiceId, {
    actorId: platformAdminId,
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, invoice);
});

export const markInvoicePaid = asyncHandler(async (req: Request, res: Response) => {
  const platformAdminId = requirePlatformAdmin(req);
  const { id, invoiceId } = invoiceIdParamSchema.parse(req.params);
  const invoice = await subscriptionBillingService.markPaid(id, invoiceId, {
    actorId: platformAdminId,
    platformAdminId,
    ...actorMeta(req),
  });
  sendSuccess(res, invoice);
});

export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  requirePlatformAdmin(req);
  const { id, invoiceId } = invoiceIdParamSchema.parse(req.params);
  const pdf = await subscriptionBillingService.getPdf(id, invoiceId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="invoice.pdf"');
  res.send(pdf);
});
