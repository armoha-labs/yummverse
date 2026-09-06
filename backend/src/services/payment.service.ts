import { Types } from "mongoose";
import { paymentRepository } from "../repositories/payment.repository.js";
import { orderRepository } from "../repositories/order.repository.js";
import { tenantPaymentSettingsRepository } from "../repositories/tenantPaymentSettings.repository.js";
import { tenantLimitsService } from "./tenantLimits.service.js";
import { auditService, type AuditContext } from "./audit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { decrypt } from "../utils/encryption.js";
import { PaymentProviderFactory } from "../payment/PaymentProviderFactory.js";
import { Order } from "../models/Order.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { realtimeEvents } from "../sockets/realtimeEvents.js";
import { notificationService } from "../notifications/NotificationService.js";
import { logger } from "../config/logger.js";
import type { ProviderCredentials } from "../payment/PaymentProvider.js";
import type { PaymentProviderName } from "../models/TenantPaymentSettings.js";

function fireAndForget(promise: Promise<void>): void {
  promise.catch((err: unknown) => logger.warn({ err }, "Push notification failed"));
}

type Actor = Omit<AuditContext, "actorType" | "actorId" | "tenantId"> & { actorId: string };

/**
 * Shared by the customer QR flow and staff-initiated POS payments (§23A.3's "same
 * encrypted branch payment settings, same backend-verified PAID transition as an online
 * payment"). `sessionId` is present only for a QR customer session — when absent, the
 * caller is already-authenticated staff acting within their own branch (route middleware
 * has verified that), so there's no separate session-ownership check to perform.
 */
export interface OrderAccessContext {
  tenantId: string;
  branchId: string;
  sessionId?: string;
}

function assertOrderAccess(
  order: { customer?: { sessionId?: unknown } | null } | null | undefined,
  ctx: OrderAccessContext,
) {
  if (!order) throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
  if (ctx.sessionId && order.customer?.sessionId?.toString() !== ctx.sessionId) {
    throw ApiError.notFound("ORDER_NOT_FOUND", "Order not found.");
  }
}

async function resolveCredentials(
  tenantId: string,
  branchId: string,
): Promise<{ provider: PaymentProviderName; credentials: ProviderCredentials; currency: string; testMode: boolean }> {
  const limits = await tenantLimitsService.resolveEffectiveLimits(tenantId);
  if (!limits.paymentGatewayEnabled) {
    throw ApiError.badRequest("PAYMENT_GATEWAY_DISABLED", "Online payment is not available on this café's current plan.");
  }

  const settings = await tenantPaymentSettingsRepository.findResolved(tenantId, branchId);
  if (!settings || !settings.enabled || !settings.credentials?.keyId || !settings.credentials.keySecretEncrypted) {
    throw ApiError.badRequest("PAYMENT_NOT_CONFIGURED", "This café has not enabled online payment yet.");
  }

  return {
    provider: settings.provider as PaymentProviderName,
    credentials: {
      keyId: settings.credentials.keyId,
      keySecret: decrypt(settings.credentials.keySecretEncrypted),
      webhookSecret: settings.credentials.webhookSecretEncrypted
        ? decrypt(settings.credentials.webhookSecretEncrypted)
        : undefined,
    },
    currency: settings.currency,
    testMode: settings.testMode,
  };
}

/** Smallest-currency-unit conversion (e.g. rupees → paise) — Razorpay and most gateways expect this. */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export const paymentService = {
  async createPayment(ctx: OrderAccessContext, orderId: string) {
    const order = await orderRepository.findById(ctx.tenantId, orderId);
    assertOrderAccess(order, ctx);
    if (order!.orderStatus !== "PENDING_PAYMENT") {
      throw ApiError.conflict("ORDER_NOT_PAYABLE", "This order is not awaiting payment.");
    }

    // Idempotent: reuse an already-created gateway order for this order rather than opening
    // a second one on a retried checkout click / page refresh.
    const existing = await paymentRepository.findForOrder(ctx.tenantId, orderId);
    if (existing && existing.status !== "FAILED") {
      return {
        paymentId: existing._id,
        providerOrderId: existing.providerOrderId,
        amount: existing.amount,
        currency: existing.currency,
      };
    }

    const { provider: providerName, credentials, currency, testMode } = await resolveCredentials(
      ctx.tenantId,
      ctx.branchId,
    );
    const provider = PaymentProviderFactory.getProvider(providerName);

    const gatewayOrder = await provider.createOrder({
      credentials,
      amount: toMinorUnits(order!.totalAmount),
      currency,
      receipt: order!.orderNumber.toString(),
      testMode,
    });

    const payment = await paymentRepository.create({
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      orderId: order!._id,
      provider: providerName,
      providerOrderId: gatewayOrder.providerOrderId,
      amount: order!.totalAmount,
      currency,
      status: "CREATED",
    });

    order!.paymentId = payment._id;
    await order!.save();

    return {
      paymentId: payment._id,
      providerOrderId: gatewayOrder.providerOrderId,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      keyId: credentials.keyId,
    };
  },

  async verifyPayment(
    ctx: OrderAccessContext,
    input: { paymentId: string; providerPaymentId: string; signature: string },
  ) {
    const payment = await paymentRepository.findById(ctx.tenantId, input.paymentId);
    if (!payment || !payment.providerOrderId) {
      throw ApiError.notFound("PAYMENT_NOT_FOUND", "Payment not found.");
    }
    const order = await orderRepository.findById(ctx.tenantId, payment.orderId);
    assertOrderAccess(order, ctx);

    const { provider: providerName, credentials } = await resolveCredentials(ctx.tenantId, ctx.branchId);
    const provider = PaymentProviderFactory.getProvider(providerName);

    const result = await provider.verifyPayment({
      credentials,
      providerOrderId: payment.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature,
    });

    if (!result.verified) {
      payment.status = "FAILED";
      await payment.save();
      order!.paymentStatus = "FAILED";
      order!.orderStatus = "PAYMENT_FAILED";
      await order!.save();
      realtimeEvents.paymentEvent(ctx.tenantId, ctx.branchId, "payment.failed", payment, ctx.sessionId);
      fireAndForget(notificationService.notifyCustomerPaymentFailed(order!));
      throw ApiError.badRequest("PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
    }

    payment.status = "PAID";
    payment.providerPaymentId = input.providerPaymentId;
    if (result.method) payment.method = result.method;
    await payment.save();

    order!.paymentStatus = "PAID";
    order!.orderStatus = "NEW";
    order!.paymentMethod = result.method;
    await order!.save();

    realtimeEvents.paymentEvent(ctx.tenantId, ctx.branchId, "payment.paid", payment, ctx.sessionId);
    realtimeEvents.orderCreated(ctx.tenantId, ctx.branchId, order!);
    fireAndForget(notificationService.notifyKitchenNewOrder(order!));
    fireAndForget(notificationService.notifyCustomerOrderReceived(order!));

    return { verified: true, order: order! };
  },

  /** §37: identify the provider order id from the payload first, resolve OUR trusted Payment
   * record, and only then load that tenant's webhook secret — never trust a tenant id from
   * the request itself. */
  async processWebhook(rawBody: string, signatureHeader: string, providerEventIdHeader: string | undefined) {
    let parsed: { event?: string; payload?: { payment?: { entity?: { order_id?: string } } } };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw ApiError.badRequest("INVALID_WEBHOOK_PAYLOAD", "Malformed webhook payload.");
    }

    const providerOrderId = parsed.payload?.payment?.entity?.order_id;
    if (!providerOrderId) {
      // Not a payment event we track (e.g. account-level event) — acknowledge without acting.
      return { acknowledged: true };
    }

    const payment = await paymentRepository.findByProviderOrderId(providerOrderId);
    if (!payment) {
      return { acknowledged: true };
    }

    const { provider: providerName, credentials } = await resolveCredentials(
      payment.tenantId.toString(),
      payment.branchId.toString(),
    );
    if (!credentials.webhookSecret) {
      throw ApiError.badRequest("WEBHOOK_NOT_CONFIGURED", "No webhook secret configured for this tenant.");
    }
    const provider = PaymentProviderFactory.getProvider(providerName);

    const result = await provider.processWebhook({ credentials, rawBody, signatureHeader });
    if (!result.verified) {
      throw ApiError.unauthorized("INVALID_WEBHOOK_SIGNATURE", "Webhook signature verification failed.");
    }

    const providerEventId = providerEventIdHeader ?? `${providerOrderId}:${result.eventType ?? "unknown"}`;
    try {
      await WebhookEvent.create({
        tenantId: payment.tenantId,
        provider: providerName,
        providerEventId,
        eventType: result.eventType ?? "unknown",
      });
    } catch (err) {
      if (err instanceof Error && "code" in err && (err as { code?: number }).code === 11000) {
        return { acknowledged: true, duplicate: true }; // already processed (§38)
      }
      throw err;
    }

    if (result.eventType === "payment.captured" && result.providerPaymentId) {
      payment.status = "PAID";
      payment.providerPaymentId = result.providerPaymentId;
      await payment.save();
      const order = await Order.findOneAndUpdate(
        { _id: payment.orderId },
        { paymentStatus: "PAID", orderStatus: "NEW" },
        { new: true },
      );
      if (order) {
        const sessionId = order.customer?.sessionId?.toString();
        realtimeEvents.paymentEvent(
          payment.tenantId.toString(),
          payment.branchId.toString(),
          "payment.paid",
          payment,
          sessionId,
        );
        realtimeEvents.orderCreated(payment.tenantId.toString(), payment.branchId.toString(), order);
        fireAndForget(notificationService.notifyKitchenNewOrder(order));
        fireAndForget(notificationService.notifyCustomerOrderReceived(order));
      }
    } else if (result.eventType === "payment.failed") {
      payment.status = "FAILED";
      await payment.save();
      const order = await Order.findOneAndUpdate(
        { _id: payment.orderId },
        { paymentStatus: "FAILED", orderStatus: "PAYMENT_FAILED" },
        { new: true },
      );
      if (order) fireAndForget(notificationService.notifyCustomerPaymentFailed(order));
      realtimeEvents.paymentEvent(
        payment.tenantId.toString(),
        payment.branchId.toString(),
        "payment.failed",
        payment,
        order?.customer?.sessionId?.toString(),
      );
    }

    return { acknowledged: true };
  },

  /** `amount` refunds that specific amount (must fit within what's still outstanding);
   * omitted, it refunds everything still outstanding. A payment can be refunded across more
   * than one call — `refundedAmount` accumulates and `status` only flips to REFUNDED (and the
   * order along with it) once the full original amount has been returned. */
  async refund(tenantId: string, paymentId: string, actor: Actor, amount?: number) {
    const payment = await paymentRepository.findById(tenantId, paymentId);
    if (!payment) throw ApiError.notFound("PAYMENT_NOT_FOUND", "Payment not found.");
    if (payment.status !== "PAID") {
      throw ApiError.conflict("PAYMENT_NOT_REFUNDABLE", "Only a paid payment can be refunded.");
    }

    const alreadyRefunded = payment.refundedAmount ?? 0;
    const remaining = Math.round((payment.amount - alreadyRefunded) * 100) / 100;
    if (remaining <= 0) {
      throw ApiError.conflict("PAYMENT_NOT_REFUNDABLE", "This payment has already been fully refunded.");
    }
    if (amount !== undefined && amount > remaining) {
      throw ApiError.badRequest(
        "INVALID_REFUND_AMOUNT",
        `Refund amount cannot exceed the outstanding balance of ${remaining}.`,
      );
    }
    const refundAmount = amount ?? remaining;

    // CASH (and any other provider-less payment, §23A.3) has no gateway to call — refunding
    // it is a bookkeeping action; staff hands the cash back out of band.
    if (payment.provider) {
      if (!payment.providerPaymentId) {
        throw ApiError.conflict("PAYMENT_NOT_REFUNDABLE", "No gateway payment id on record.");
      }
      const { provider: providerName, credentials } = await resolveCredentials(
        tenantId,
        payment.branchId.toString(),
      );
      const provider = PaymentProviderFactory.getProvider(providerName);

      await provider.refund({
        credentials,
        providerPaymentId: payment.providerPaymentId,
        amount: toMinorUnits(refundAmount),
      });
    }

    const newRefundedAmount = Math.round((alreadyRefunded + refundAmount) * 100) / 100;
    const fullyRefunded = newRefundedAmount >= payment.amount;

    payment.refundedAmount = newRefundedAmount;
    if (fullyRefunded) payment.status = "REFUNDED";
    await payment.save();

    if (fullyRefunded) {
      await Order.updateOne(
        { _id: payment.orderId },
        { paymentStatus: "REFUNDED", orderStatus: "REFUNDED" },
      );
    }

    await auditService.record({
      tenantId,
      actorType: "USER",
      actorId: actor.actorId,
      action: "REFUND_CREATED",
      entityType: "Payment",
      entityId: payment._id as Types.ObjectId,
      before: { refundedAmount: alreadyRefunded },
      after: { refundedAmount: newRefundedAmount, amount: refundAmount, fullyRefunded },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return payment;
  },
};
