import { z } from "zod";

export const createPosOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
        note: z.string().optional(),
      }),
    )
    .min(1),
  tableId: z.string().optional(),
  branchId: z.string().optional(), // Tenant Admin only — Waiter's branch comes from their token
});

export const posPaySchema = z.object({
  method: z.enum(["CASH", "POS_CARD", "PAYMENT_LINK"]),
});
