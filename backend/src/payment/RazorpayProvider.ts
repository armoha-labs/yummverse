import crypto from "node:crypto";
import Razorpay from "razorpay";
import type {
  PaymentProvider,
  CreateOrderInput,
  PaymentOrder,
  VerifyPaymentInput,
  PaymentVerification,
  WebhookInput,
  WebhookResult,
  RefundInput,
  RefundResult,
  ProviderCredentials,
  TestConnectionResult,
} from "./PaymentProvider.js";

function client(credentials: ProviderCredentials): Razorpay {
  return new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
}

export class RazorpayProvider implements PaymentProvider {
  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    const order = await client(input.credentials).orders.create({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
    });
    return { providerOrderId: order.id, amount: Number(order.amount), currency: order.currency };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerification> {
    const expected = crypto
      .createHmac("sha256", input.credentials.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest("hex");

    const verified = timingSafeEqualHex(expected, input.signature);
    return { verified };
  }

  async processWebhook(input: WebhookInput): Promise<WebhookResult> {
    if (!input.credentials.webhookSecret) {
      return { verified: false };
    }

    const expected = crypto
      .createHmac("sha256", input.credentials.webhookSecret)
      .update(input.rawBody)
      .digest("hex");

    if (!timingSafeEqualHex(expected, input.signatureHeader)) {
      return { verified: false };
    }

    const payload = JSON.parse(input.rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string } };
        order?: { entity?: { id?: string } };
      };
    };

    return {
      verified: true,
      eventType: payload.event,
      providerOrderId:
        payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id,
      providerPaymentId: payload.payload?.payment?.entity?.id,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    // Razorpay dummy credentials only exist in dev/test — real calls happen once a tenant
    // saves genuine keys, exercised by Phase 9 (§9).
    const refund = await client(input.credentials).payments.refund(input.providerPaymentId, {
      amount: input.amount,
    });
    return { providerRefundId: refund.id, status: refund.status };
  }

  async testConnection(credentials: ProviderCredentials): Promise<TestConnectionResult> {
    try {
      await client(credentials).orders.all({ count: 1 });
      return { ok: true, message: "Connected successfully." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to connect with these credentials.";
      return { ok: false, message };
    }
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
