import { z } from "zod";

export const listStaffQuerySchema = z.object({
  role: z.enum(["WAITER", "KITCHEN"]).optional(),
});

export const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["WAITER", "KITCHEN"]), // never TENANT_ADMIN or PLATFORM_ADMIN via this endpoint (§8A.3)
  branchId: z.string().min(1),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  branchId: z.string().min(1).optional(),
});
