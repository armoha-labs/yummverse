import { branchRepository } from "../repositories/branch.repository.js";
import { ApiError } from "../utils/ApiError.js";

/** Tenant Admin isn't branch-locked (§6A.5) — every tenant is exactly one café, so the
 * branch is always unambiguous: the tenant's auto-provisioned default branch. */
export async function resolveActingBranchId(tenantId: string, branchId?: string): Promise<string> {
  if (branchId) {
    const branch = await branchRepository.findById(tenantId, branchId);
    if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");
    return branchId;
  }
  const branch = await branchRepository.findDefaultForTenant(tenantId);
  if (!branch) throw ApiError.notFound("BRANCH_NOT_FOUND", "Branch not found.");
  return (branch._id as { toString(): string }).toString();
}
