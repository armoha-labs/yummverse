import type { Request, Response } from "express";
import { resolveQrContext } from "../services/customerSession.service.js";
import { resolveTenantBySlug } from "../tenant/context.js";
import { publicMenuService } from "../services/publicMenu.service.js";
import { resolveAllowPayLater, resolveKitchenEnabled } from "../services/orderCalculation.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { qrTokenParamSchema, tenantSlugQuerySchema } from "../validators/public.validators.js";

export const getTableByQrToken = asyncHandler(async (req: Request, res: Response) => {
  const { qrToken } = qrTokenParamSchema.parse(req.params);
  const { table, branch, tenant } = await resolveQrContext(qrToken);
  const tenantId = tenant._id.toString();
  const branchId = branch._id.toString();
  const [allowPayLater, kitchenEnabled] = await Promise.all([
    resolveAllowPayLater(tenantId, branchId),
    resolveKitchenEnabled(tenantId, branchId),
  ]);

  sendSuccess(res, {
    table: { tableNumber: table.tableNumber, status: table.status },
    branch: { id: branch._id, name: branch.name, allowPayLater, kitchenEnabled },
    tenant: {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      currency: tenant.currency,
      branding: tenant.branding ?? {},
    },
  });
});

export const getTenantBranding = asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug } = tenantSlugQuerySchema.parse(req.query);
  const tenant = await resolveTenantBySlug(tenantSlug);
  // §32's staff login page renders "logo, name, colors" from this public lookup — name is
  // not sensitive (it's on the QR-landing response too) and is required for that branding.
  // Branding only: kitchen/table-status workflow flags are branch-level (§6A.2), and this
  // lookup has no branch context (it's keyed by tenant slug alone, reachable pre-login) — see
  // GET /waiter/settings and GET /kitchen/settings for the branch-aware equivalent.
  sendSuccess(res, { name: tenant.name, ...(tenant.branding ?? {}) });
});

// §22B: the client fetches the full menu once, right after the QR/table token resolves
// tenant+branch — i.e. using the session just created by POST /customer/session (§56).
export const getPublicCategories = asyncHandler(async (req: Request, res: Response) => {
  if (!req.customerSession) throw ApiError.unauthorized("MISSING_SESSION");
  const categories = await publicMenuService.getCategories(req.customerSession.tenantId);
  sendSuccess(res, categories);
});

export const getPublicMenu = asyncHandler(async (req: Request, res: Response) => {
  if (!req.customerSession) throw ApiError.unauthorized("MISSING_SESSION");
  const items = await publicMenuService.getMenu(req.customerSession.tenantId, req.customerSession.branchId);
  sendSuccess(res, items);
});
