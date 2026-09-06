import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword } from "../src/utils/password.js";

vi.mock("razorpay", () => {
  class MockRazorpay {
    orders = {
      create: async (opts: { amount: number; currency: string; receipt: string }) => ({
        id: `order_mock_${opts.receipt}`,
        amount: opts.amount,
        currency: opts.currency,
      }),
      all: async () => ({ items: [] }),
    };
    payments = {
      refund: async (paymentId: string) => ({ id: `rfnd_${paymentId}`, status: "processed" }),
    };
  }
  return { default: MockRazorpay };
});

const KEY_ID = "rzp_test_key";
const KEY_SECRET = "rzp_test_secret";
const WEBHOOK_SECRET = "whsec_test";

async function createActivatedTenantAdmin(slug: string) {
  const passwordHash = await hashPassword("PlatformPass123!");
  const platformAdmin = await PlatformAdmin.create({
    name: "Root",
    email: `${slug}-root@yummverse.test`,
    passwordHash,
  });

  const { tenant, branch, admin, inviteToken } = await tenantService.createTenant(
    { name: slug, slug, adminName: "Admin", adminEmail: `admin@${slug}.test` },
    { platformAdminId: platformAdmin._id.toString() },
  );
  await Tenant.updateOne({ _id: tenant._id }, { status: "ACTIVE" });

  const app = createApp();
  await request(app)
    .post("/api/v1/auth/accept-invite")
    .send({ tenantSlug: slug, email: admin.email, inviteToken, newPassword: "AdminPass123!" });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ tenantSlug: slug, email: admin.email, password: "AdminPass123!" });

  return { app, tenant, defaultBranch: branch, accessToken: login.body.data.accessToken as string };
}

async function setUpOrder(app: ReturnType<typeof createApp>, accessToken: string, configurePayments = true) {
  if (configurePayments) {
    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        provider: "RAZORPAY",
        keyId: KEY_ID,
        keySecret: KEY_SECRET,
        webhookSecret: WEBHOOK_SECRET,
        currency: "INR",
        enabled: true,
        testMode: true,
      });
  }

  const category = await request(app)
    .post("/api/v1/admin/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Coffee" });
  const item = await request(app)
    .post("/api/v1/admin/menu-items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ categoryId: category.body.data._id, name: "Cappuccino", price: 150 });
  const table = await request(app)
    .post("/api/v1/admin/tables")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ tableNumber: "1" });
  const session = await request(app)
    .post("/api/v1/customer/session")
    .send({ qrToken: table.body.data.qrToken });
  const sessionToken = session.body.data.sessionToken as string;

  const order = await request(app)
    .post("/api/v1/customer/orders")
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

  return { order, sessionToken };
}

function razorpaySignature(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("payment creation & verification", () => {
  it("creates a gateway order and reuses it on a repeated create call (idempotency)", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-x");
    const { order, sessionToken } = await setUpOrder(app, accessToken);

    const first = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });
    expect(first.status).toBe(201);
    expect(first.body.data.providerOrderId).toBe(`order_mock_${order.body.data.orderNumber}`);
    expect(first.body.data.keyId).toBe(KEY_ID);

    const second = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });
    expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    expect(second.body.data.providerOrderId).toBe(first.body.data.providerOrderId);
  });

  it("fails to create a payment when the tenant hasn't configured a payment gateway", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-y");
    const { order, sessionToken } = await setUpOrder(app, accessToken, false);

    const res = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENT_NOT_CONFIGURED");
  });

  it("verifies a correctly-signed payment and transitions the order to NEW/PAID", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-z");
    const { order, sessionToken } = await setUpOrder(app, accessToken);

    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const providerPaymentId = "pay_mock_abc123";
    const signature = razorpaySignature(KEY_SECRET, `${created.body.data.providerOrderId}|${providerPaymentId}`);

    const verified = await request(app)
      .post("/api/v1/payments/verify")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ paymentId: created.body.data.paymentId, providerPaymentId, signature });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);

    const refetched = await request(app)
      .get(`/api/v1/customer/orders/${order.body.data._id}`)
      .set("Authorization", `Bearer ${sessionToken}`);
    expect(refetched.body.data.orderStatus).toBe("NEW");
    expect(refetched.body.data.paymentStatus).toBe("PAID");
  });

  it("rejects a payment with an invalid signature and marks the order PAYMENT_FAILED", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-w");
    const { order, sessionToken } = await setUpOrder(app, accessToken);

    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const verified = await request(app)
      .post("/api/v1/payments/verify")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ paymentId: created.body.data.paymentId, providerPaymentId: "pay_fake", signature: "not-a-real-signature" });
    expect(verified.status).toBe(400);
    expect(verified.body.error.code).toBe("PAYMENT_VERIFICATION_FAILED");

    const refetched = await request(app)
      .get(`/api/v1/customer/orders/${order.body.data._id}`)
      .set("Authorization", `Bearer ${sessionToken}`);
    expect(refetched.body.data.orderStatus).toBe("PAYMENT_FAILED");
  });
});

describe("payment webhooks (§37, §38)", () => {
  it("processes a valid payment.captured webhook and is idempotent on redelivery", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-webhook-a");
    const { order, sessionToken } = await setUpOrder(app, accessToken);
    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_webhook_1", order_id: created.body.data.providerOrderId },
        },
      },
    });
    const signature = razorpaySignature(WEBHOOK_SECRET, rawBody);

    const first = await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .set("x-razorpay-event-id", "evt_1")
      .send(rawBody);
    expect(first.status).toBe(200);

    const refetched = await request(app)
      .get(`/api/v1/customer/orders/${order.body.data._id}`)
      .set("Authorization", `Bearer ${sessionToken}`);
    expect(refetched.body.data.orderStatus).toBe("NEW");
    expect(refetched.body.data.paymentStatus).toBe("PAID");

    // redelivery of the same event must not error or double-process
    const redelivered = await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .set("x-razorpay-event-id", "evt_1")
      .send(rawBody);
    expect(redelivered.status).toBe(200);
    expect(redelivered.body.data.duplicate).toBe(true);
  });

  it("rejects a webhook with a bad signature", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-webhook-b");
    const { order, sessionToken } = await setUpOrder(app, accessToken);
    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_x", order_id: created.body.data.providerOrderId } } },
    });

    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "totally-wrong")
      .send(rawBody);
    expect(res.status).toBe(401);
  });
});

describe("refunds", () => {
  it("tenant admin can refund a paid payment; refunding an unpaid one is rejected", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("pay-refund");
    const { order, sessionToken } = await setUpOrder(app, accessToken);
    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const unpaidRefund = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(unpaidRefund.status).toBe(409);

    const providerPaymentId = "pay_to_refund";
    const signature = razorpaySignature(KEY_SECRET, `${created.body.data.providerOrderId}|${providerPaymentId}`);
    await request(app)
      .post("/api/v1/payments/verify")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ paymentId: created.body.data.paymentId, providerPaymentId, signature });

    const refund = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(refund.status).toBe(200);
    expect(refund.body.data.status).toBe("REFUNDED");

    const actions = (await AuditLog.find({ tenantId: tenant._id })).map((a) => a.action);
    expect(actions).toContain("REFUND_CREATED");
  });

  it("supports refunding a specific amount, across more than one instalment, capped at what's outstanding", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-partial-refund");
    const { order, sessionToken } = await setUpOrder(app, accessToken); // total = ₹150
    const created = await request(app)
      .post("/api/v1/payments/create")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ orderId: order.body.data._id });

    const providerPaymentId = "pay_partial_refund";
    const signature = razorpaySignature(KEY_SECRET, `${created.body.data.providerOrderId}|${providerPaymentId}`);
    await request(app)
      .post("/api/v1/payments/verify")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ paymentId: created.body.data.paymentId, providerPaymentId, signature });

    // Over-refunding is rejected before any gateway call is made.
    const tooMuch = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amount: 200 });
    expect(tooMuch.status).toBe(400);

    const firstPartial = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amount: 60 });
    expect(firstPartial.status).toBe(200);
    expect(firstPartial.body.data.status).toBe("PAID"); // not yet fully refunded
    expect(firstPartial.body.data.refundedAmount).toBe(60);

    // The order stays PAID/NEW after a partial refund — only a full refund flips it.
    const midOrder = await request(app)
      .get(`/api/v1/admin/orders/${order.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(midOrder.body.data.paymentStatus).toBe("PAID");

    const secondPartial = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amount: 90 });
    expect(secondPartial.status).toBe(200);
    expect(secondPartial.body.data.status).toBe("REFUNDED");
    expect(secondPartial.body.data.refundedAmount).toBe(150);

    const finalOrder = await request(app)
      .get(`/api/v1/admin/orders/${order.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(finalOrder.body.data.paymentStatus).toBe("REFUNDED");

    const overRefund = await request(app)
      .post(`/api/v1/payments/${created.body.data.paymentId}/refund`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(overRefund.status).toBe(409);
  });
});
