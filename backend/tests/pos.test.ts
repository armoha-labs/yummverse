import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { User } from "../src/models/User.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword, hashToken } from "../src/utils/password.js";

vi.mock("razorpay", () => {
  class MockRazorpay {
    orders = {
      create: async (opts: { amount: number; currency: string; receipt: string }) => ({
        id: `order_mock_${opts.receipt}`,
        amount: opts.amount,
        currency: opts.currency,
      }),
    };
  }
  return { default: MockRazorpay };
});

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

async function createWaiterAndLogin(
  app: ReturnType<typeof createApp>,
  slug: string,
  adminToken: string,
  branchId: string,
  email: string,
) {
  const created = await request(app)
    .post("/api/v1/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Waiter", email, role: "WAITER", branchId });

  const inviteToken = `token-${email}`;
  await User.updateOne(
    { _id: created.body.data._id },
    { inviteTokenHash: hashToken(inviteToken), inviteTokenExpiresAt: new Date(Date.now() + 60_000) },
  );
  await request(app)
    .post("/api/v1/auth/accept-invite")
    .send({ tenantSlug: slug, email, inviteToken, newPassword: "StaffPass123!" });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ tenantSlug: slug, email, password: "StaffPass123!" });

  return login.body.data.accessToken as string;
}

async function setUpMenu(app: ReturnType<typeof createApp>, accessToken: string) {
  const category = await request(app)
    .post("/api/v1/admin/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Coffee" });
  const item = await request(app)
    .post("/api/v1/admin/menu-items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ categoryId: category.body.data._id, name: "Cappuccino", price: 150 });
  return item.body.data._id as string;
}

describe("POS / counter ordering (§23A)", () => {
  it("a waiter can create a takeaway POS order and settle it in cash", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pos-a");
    const itemId = await setUpMenu(app, accessToken);
    const waiterToken = await createWaiterAndLogin(
      app,
      "pos-a",
      accessToken,
      defaultBranch._id.toString(),
      "waiter@pos-a.test",
    );

    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 2 }] });
    expect(order.status).toBe(201);
    expect(order.body.data.channel).toBe("POS");
    expect(order.body.data.customer.name).toBe("Takeaway");
    expect(order.body.data.totalAmount).toBe(300);

    const pay = await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ method: "CASH" });
    expect(pay.status).toBe(200);
    expect(pay.body.data.order.orderStatus).toBe("NEW");
    expect(pay.body.data.order.paymentStatus).toBe("PAID");
    expect(pay.body.data.payment.method).toBe("CASH");
    expect(pay.body.data.payment.provider).toBeUndefined();

    const payAgain = await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ method: "CASH" });
    expect(payAgain.status).toBe(409);
  });

  it("a POS order can be tied to a table and shows up in the kitchen queue like any other order", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pos-b");
    const itemId = await setUpMenu(app, accessToken);
    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "7" });
    const waiterToken = await createWaiterAndLogin(
      app,
      "pos-b",
      accessToken,
      defaultBranch._id.toString(),
      "waiter@pos-b.test",
    );

    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 1 }], tableId: table.body.data._id });
    expect(order.body.data.customer.name).toBe("Table 7");

    await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ method: "CASH" });

    const kitchenQueue = await request(app)
      .get("/api/v1/admin/kitchen/orders")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(kitchenQueue.body.data.map((o: { _id: string }) => o._id)).toContain(order.body.data._id);
  });

  it("PAYMENT_LINK routes through the same PaymentProvider abstraction as online QR payment", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pos-c");
    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "rzp_key", keySecret: "rzp_secret", enabled: true });
    const itemId = await setUpMenu(app, accessToken);

    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 1 }] });

    const pay = await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ method: "PAYMENT_LINK" });
    expect(pay.status).toBe(200);
    expect(pay.body.data.providerOrderId).toContain("order_mock_");
    expect(pay.body.data.keyId).toBe("rzp_key");

    // order stays pending until the gateway confirms via webhook — never optimistically marked paid
    const refetched = await request(app)
      .get("/api/v1/admin/kitchen/orders")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(refetched.body.data.map((o: { _id: string }) => o._id)).not.toContain(order.body.data._id);
  });

  it("rejects POS_CARD when it isn't enabled (off by default — no card-terminal SDK wired up)", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pos-e");
    const itemId = await setUpMenu(app, accessToken);
    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 1 }] });

    const pay = await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ method: "POS_CARD" });
    expect(pay.status).toBe(400);
    expect(pay.body.error.code).toBe("POS_CARD_DISABLED");

    const settings = await request(app)
      .get("/api/v1/pos/settings")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(settings.body.data.posCardEnabled).toBe(false);
  });

  it("accepts POS_CARD once the tenant enables it, and a branch override can turn it back off", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pos-f");
    const itemId = await setUpMenu(app, accessToken);

    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ payment: { posCardEnabled: true } });

    const settings = await request(app)
      .get("/api/v1/pos/settings")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(settings.body.data.posCardEnabled).toBe(true);

    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 1 }] });
    const pay = await request(app)
      .post(`/api/v1/pos/orders/${order.body.data._id}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ method: "POS_CARD" });
    expect(pay.status).toBe(200);
    expect(pay.body.data.payment.method).toBe("POS_CARD");

    // Branch override turns it back off for this branch specifically, independent of the
    // tenant-wide default that's still on.
    const branchId = defaultBranch._id.toString();
    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { payment: { posCardEnabled: false } } });

    const branchSettings = await request(app)
      .get(`/api/v1/pos/settings?branchId=${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(branchSettings.body.data.posCardEnabled).toBe(false);
  });

  it("setting posCardEnabled on a branch doesn't reset an already-set allowPayLater override (and vice versa)", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pos-g");
    const branchId = defaultBranch._id.toString();

    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { payment: { allowPayLater: true } } });

    // Setting ONLY posCardEnabled afterward must not silently reintroduce an
    // allowPayLater: false override that was never asked for.
    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { payment: { posCardEnabled: true } } });

    const branches = await request(app)
      .get("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`);
    const branch = branches.body.data.find((b: { _id: string }) => b._id === branchId);
    expect(branch.settings.payment.allowPayLater).toBe(true);
    expect(branch.settings.payment.posCardEnabled).toBe(true);
  });

  it("rejects an item unavailable at this branch, same rule as QR ordering", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pos-d");
    const itemId = await setUpMenu(app, accessToken);
    await request(app)
      .put(`/api/v1/admin/menu-items/${itemId}/branch-overrides/${defaultBranch._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isAvailable: false });

    const order = await request(app)
      .post("/api/v1/pos/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ menuItemId: itemId, quantity: 1 }] });
    expect(order.status).toBe(400);
  });
});
