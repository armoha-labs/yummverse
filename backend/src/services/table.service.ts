import { tableRepository } from "../repositories/table.repository.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { generateToken } from "../utils/password.js";
import { resolveActingBranchId as resolveBranchId } from "./resolveActingBranch.js";

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

export const tableService = {
  listForTenant(tenantId: string, branchId?: string) {
    return tableRepository.listForTenant(tenantId, branchId);
  },

  async create(tenantId: string, input: { tableNumber: string; branchId?: string }, actor: Actor) {
    const branchId = await resolveBranchId(tenantId, input.branchId);

    const existing = await tableRepository.findByTableNumber(tenantId, branchId, input.tableNumber);
    if (existing) {
      throw ApiError.conflict("TABLE_NUMBER_TAKEN", `Table "${input.tableNumber}" already exists on this branch.`);
    }

    const table = await tableRepository.create({
      tenantId,
      branchId,
      tableNumber: input.tableNumber,
      qrToken: generateToken(16),
    });

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TABLE_CREATED",
      entityType: "Table",
      entityId: table._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return table;
  },

  async update(tenantId: string, tableId: string, updates: { tableNumber?: string }, actor: Actor) {
    const table = await tableRepository.findById(tenantId, tableId);
    if (!table) throw ApiError.notFound("TABLE_NOT_FOUND", "Table not found.");

    if (updates.tableNumber !== undefined) table.tableNumber = updates.tableNumber;
    await table.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TABLE_UPDATED",
      entityType: "Table",
      entityId: table._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return table;
  },

  async regenerateQr(tenantId: string, tableId: string, actor: Actor) {
    const table = await tableRepository.findById(tenantId, tableId);
    if (!table) throw ApiError.notFound("TABLE_NOT_FOUND", "Table not found.");

    table.qrToken = generateToken(16);
    await table.save();

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TABLE_QR_REGENERATED",
      entityType: "Table",
      entityId: table._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return table;
  },

  async delete(tenantId: string, tableId: string, actor: Actor) {
    const table = await tableRepository.findById(tenantId, tableId);
    if (!table) throw ApiError.notFound("TABLE_NOT_FOUND", "Table not found.");
    if (table.currentOrderId) {
      throw ApiError.conflict("TABLE_HAS_ACTIVE_ORDER", "Resolve the table's active order before deleting it.");
    }

    await tableRepository.delete(tenantId, tableId);

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "TABLE_DELETED",
      entityType: "Table",
      entityId: table._id,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  },
};
