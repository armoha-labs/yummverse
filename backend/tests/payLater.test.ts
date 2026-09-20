import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword } from "../src/utils/password.js";

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

async function setUpMenuAndTable(app: ReturnType<typeof createApp>, accessToken: string) {
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
    .send({ tableNumber: "9" });

  return { itemId: item.body.data._id as string, qrToken: table.body.data.qrToken as string };
}

async function startCustomerSession(app: ReturnType<typeof createApp>, qrToken: string) {
  const session = await request(app).post("/api/v1/customer/session").send({ qrToken });
  return session.body.data.sessionToken as string;
}

describe("pay-later ordering (§23)", () => {
  it("QR context reports allowPayLater; toggling the tenant setting flips it", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-later-flag");
    const { qrToken } = await setUpMenuAndTable(app, accessToken);

    const before = await request(app).get(`/api/v1/public/tables/${qrToken}`);
    expect(before.body.data.branch.allowPayLater).toBe(false);

    const updated = await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ payment: { allowPayLater: true } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.payment.allowPayLater).toBe(true);

    const after = await request(app).get(`/api/v1/public/tables/${qrToken}`);
    expect(after.body.data.branch.allowPayLater).toBe(true);
  });

  it("rejects a pay-later order when the branch doesn't allow it", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-later-blocked");
    const { itemId, qrToken } = await setUpMenuAndTable(app, accessToken);
    const sessionToken = await startCustomerSession(app, qrToken);

    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: itemId, quantity: 1 }], payLater: true });

    expect(order.status).toBe(403);
  });

  it("a pay-later order skips straight to the kitchen queue, unpaid, and staff can collect payment afterward without losing kitchen progress", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-later-ok");
    const { itemId, qrToken } = await setUpMenuAndTable(app, accessToken);

    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ payment: { allowPayLater: true } });

    const sessionToken = await startCustomerSession(app, qrToken);
    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: itemId, quantity: 1 }], payLater: true });

    expect(order.status).toBe(201);
    expect(order.body.data.orderStatus).toBe("NEW");
    expect(order.body.data.paymentStatus).toBe("PENDING");
    const orderId = order.body.data._id as string;

    // It's immediately visible to the kitchen, unpaid.
    const kitchenQueue = await request(app)
      .get("/api/v1/admin/kitchen/orders")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(kitchenQueue.body.data.some((o: { _id: string }) => o._id === orderId)).toBe(true);

    // Kitchen accepts and starts preparing before payment is ever collected.
    await request(app)
      .post(`/api/v1/admin/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${accessToken}`);
    const preparing = await request(app)
      .post(`/api/v1/admin/kitchen/orders/${orderId}/preparing`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(preparing.body.data.orderStatus).toBe("PREPARING");

    // Staff now collects cash — orderStatus must stay PREPARING, not get reset to NEW.
    const paid = await request(app)
      .post(`/api/v1/pos/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ method: "CASH" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.order.paymentStatus).toBe("PAID");
    expect(paid.body.data.order.orderStatus).toBe("PREPARING");

    // And it can't be paid twice.
    const secondAttempt = await request(app)
      .post(`/api/v1/pos/orders/${orderId}/pay`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ method: "CASH" });
    expect(secondAttempt.status).toBe(409);
  });
});
