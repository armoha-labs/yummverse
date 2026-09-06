import { z } from "zod";
import { ORDER_STATUSES } from "../models/Order.js";

export const listOrdersQuerySchema = z.object({
  branchId: z.string().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
