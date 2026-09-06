import type { Request, Response } from "express";
import { tableService } from "../services/table.service.js";
import { tableRepository } from "../repositories/table.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { generateQrPng } from "../utils/qr.js";
import { generateTablesQrPdf } from "../utils/qrPdf.js";
import { idParamSchema } from "../validators/common.validators.js";
import { branchIdQuerySchema, createTableSchema, updateTableSchema } from "../validators/table.validators.js";

function requireTenantContext(req: Request): { tenantId: string; actorId: string } {
  if (!req.tenantId || !req.auth) throw ApiError.forbidden("TENANT_CONTEXT_REQUIRED");
  return { tenantId: req.tenantId, actorId: req.auth.sub };
}

function actorMeta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

export const listTables = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);
  const tables = await tableService.listForTenant(tenantId, branchId);
  sendSuccess(res, tables);
});

export const getTable = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const table = await tableRepository.findById(tenantId, id);
  if (!table) throw ApiError.notFound("TABLE_NOT_FOUND");
  sendSuccess(res, table);
});

export const createTable = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const input = createTableSchema.parse(req.body);
  const table = await tableService.create(tenantId, input, { actorId, ...actorMeta(req) });
  sendSuccess(res, table, 201);
});

export const updateTable = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const updates = updateTableSchema.parse(req.body);
  const table = await tableService.update(tenantId, id, updates, { actorId, ...actorMeta(req) });
  sendSuccess(res, table);
});

export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  await tableService.delete(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, { message: "Table deleted." });
});

export const regenerateTableQr = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, actorId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const table = await tableService.regenerateQr(tenantId, id, { actorId, ...actorMeta(req) });
  sendSuccess(res, table);
});

export const getTableQrImage = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { id } = idParamSchema.parse(req.params);
  const table = await tableRepository.findById(tenantId, id);
  if (!table) throw ApiError.notFound("TABLE_NOT_FOUND");

  const png = await generateQrPng(table.qrToken);
  res.setHeader("Content-Type", "image/png");
  res.send(png);
});

export const exportAllTablesQr = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = requireTenantContext(req);
  const { branchId } = branchIdQuerySchema.parse(req.query);

  const [tenant, tables] = await Promise.all([
    tenantRepository.findById(tenantId),
    tableService.listForTenant(tenantId, branchId),
  ]);
  if (!tenant) throw ApiError.notFound("TENANT_NOT_FOUND");
  if (tables.length === 0) {
    throw ApiError.badRequest("NO_TABLES", "There are no tables to export yet.");
  }

  const pdf = await generateTablesQrPdf(
    tenant.name,
    tables.map((t) => ({ tableNumber: t.tableNumber, qrToken: t.qrToken })),
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="table-qr-codes.pdf"');
  res.send(pdf);
});
