import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Name is required."),
  customerPhone: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().min(1),
        note: z.string().optional(),
      }),
    )
    .min(1),
  payLater: z.boolean().optional(),
});
