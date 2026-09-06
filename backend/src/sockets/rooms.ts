/** Room names are the tenant-isolation boundary for real-time fan-out (§39) — never
 * "all kitchens", always scoped to a specific tenant (+ branch for branch-locked roles). */
export const rooms = {
  tenantAdmin: (tenantId: string) => `tenant:${tenantId}:admin`,
  kitchen: (tenantId: string, branchId: string) => `tenant:${tenantId}:branch:${branchId}:kitchen`,
  waiters: (tenantId: string, branchId: string) => `tenant:${tenantId}:branch:${branchId}:waiters`,
  customer: (sessionId: string) => `customer:${sessionId}`,
};
