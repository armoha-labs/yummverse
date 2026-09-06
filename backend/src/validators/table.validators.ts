import { z } from "zod";

export const branchIdQuerySchema = z.object({
  branchId: z.string().optional(),
});

export const createTableSchema = z.object({
  tableNumber: z.string().min(1),
  branchId: z.string().optional(),
});

export const updateTableSchema = z.object({
  tableNumber: z.string().min(1).optional(),
});
