import { tableRepository } from "../repositories/table.repository.js";
import { branchRepository } from "../repositories/branch.repository.js";
import { tenantRepository } from "../repositories/tenant.repository.js";
import { customerSessionRepository } from "../repositories/customerSession.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { generateToken, hashToken } from "../utils/password.js";
import { Table } from "../models/Table.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours — a typical dining session

/** §22's QR validation flow — the only trusted path from a scanned token to tenant identity. */
export async function resolveQrContext(qrToken: string) {
  const table = await tableRepository.findByQrToken(qrToken);
  if (!table) {
    throw ApiError.notFound("INVALID_QR", "This QR code is no longer valid.");
  }

  const tenant = await tenantRepository.findById(table.tenantId);
  if (!tenant) {
    throw ApiError.notFound("INVALID_QR", "This QR code is no longer valid.");
  }
  if (tenant.status !== "ACTIVE") {
    throw ApiError.forbidden("TENANT_UNAVAILABLE", "Café temporarily unavailable.");
  }

  const branch = await branchRepository.findById(tenant._id, table.branchId);
  if (!branch || branch.status !== "ACTIVE") {
    throw ApiError.notFound("INVALID_QR", "This QR code is no longer valid.");
  }

  return { table, branch, tenant };
}

export const customerSessionService = {
  resolveQrContext,

  async createSession(qrToken: string) {
    const { table, branch, tenant } = await resolveQrContext(qrToken);

    const sessionToken = generateToken();
    const session = await customerSessionRepository.create({
      tenantId: tenant._id,
      branchId: branch._id,
      tableId: table._id,
      sessionTokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    if (table.status !== "OCCUPIED") {
      await Table.updateOne({ _id: table._id }, { status: "OCCUPIED" });
      realtimeEvents.tableStatusChanged(tenant._id.toString(), branch._id.toString(), {
        tableId: table._id,
        status: "OCCUPIED",
      });
    }

    return {
      sessionToken,
      expiresAt: session.expiresAt,
      tenantId: tenant._id,
      branchId: branch._id,
      tableId: table._id,
    };
  },

  async resolveActiveSession(sessionToken: string) {
    const session = await customerSessionRepository.findActiveByTokenHash(hashToken(sessionToken));
    if (!session) {
      throw ApiError.unauthorized("INVALID_SESSION", "Your session has expired. Please scan the QR code again.");
    }
    return session;
  },
};
