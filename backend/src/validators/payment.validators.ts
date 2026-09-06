import { z } from "zod";

export const createPaymentSchema = z.object({
  orderId: z.string().min(1),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

// Omitting `amount` refunds whatever is still outstanding on the payment (§38's full-refund
// default); passing it refunds that specific amount instead, capped server-side at what's
// actually left to refund.
export const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
});
