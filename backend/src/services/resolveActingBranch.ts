import { branchRepository } from "../repositories/branch.repository.js";
import { ApiError } from "../utils/ApiError.js";

/** Tenant Admin isn't branch-locked (§6A.5) — for a single-branch tenant the branch is
 * unambiguous; a multi-branch tenant must say which one explicitly. */
export async function resolveActingBranchId(tenantId: string, branchId?: string): Promise<string> {
  if (branchId) {
    const branch = await branchRepository.findById(tenantId, branchId);
    if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");
    return branchId;
  }
  const branches = await branchRepository.listForTenant(tenantId);
  if (branches.length !== 1) {
    throw ApiError.badRequest("BRANCH_ID_REQUIRED", "branchId is required for a multi-branch tenant.");
  }
  return (branches[0]!._id as { toString(): string }).toString();
}
