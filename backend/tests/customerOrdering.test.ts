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

async function setUpMenuAndSession(app: ReturnType<typeof createApp>, accessToken: string) {
  const category = await request(app)
    .post("/api/v1/admin/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Coffee" });
  const item = await request(app)
    .post("/api/v1/admin/menu-items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ categoryId: category.body.data._id, name: "Cappuccino", price: 150, taxPercentage: 5 });
  const table = await request(app)
    .post("/api/v1/admin/tables")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ tableNumber: "1" });
  const session = await request(app)
    .post("/api/v1/customer/session")
    .send({ qrToken: table.body.data.qrToken });

  return { item, table, sessionToken: session.body.data.sessionToken as string };
}

describe("customer ordering", () => {
  it("creates an order with correct subtotal/tax totals when tax is enabled", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-a");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tax: { enabled: true, percentage: 0 } }); // percentage unused; item-level rate governs

    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);

    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 2 }] });

    expect(order.status).toBe(201);
    expect(order.body.data.subtotal).toBe(300);
    expect(order.body.data.taxAmount).toBe(15); // 300 * 5%
    expect(order.body.data.cgstAmount).toBe(7.5);
    expect(order.body.data.sgstAmount).toBe(7.5);
    expect(order.body.data.serviceCharge).toBe(0);
    expect(order.body.data.totalAmount).toBe(315);
    expect(order.body.data.orderStatus).toBe("PENDING_PAYMENT");
    expect(order.body.data.items[0].name).toBe("Cappuccino");
  });

  it("charges no tax at all when the tenant's tax setting is disabled, regardless of item rate", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-b");
    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);

    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

    expect(order.body.data.taxAmount).toBe(0);
    expect(order.body.data.cgstAmount).toBe(0);
    expect(order.body.data.sgstAmount).toBe(0);
    expect(order.body.data.totalAmount).toBe(150);
  });

  it("applies service charge on top of subtotal+tax when enabled at the tenant level", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-c");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ serviceCharge: { enabled: true, percentage: 10 } });

    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);
    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

    expect(order.body.data.serviceCharge).toBe(15); // 150 * 10%
    expect(order.body.data.totalAmount).toBe(165);
  });

  it("rejects an order for an unavailable item and for an empty cart", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-d");
    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);

    await request(app)
      .patch(`/api/v1/admin/menu-items/${item.body.data._id}/availability`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isAvailable: false });

    const unavailable = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });
    expect(unavailable.status).toBe(400);

    const empty = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [] });
    expect(empty.status).toBe(400);
  });

  it("requires customerName but never requires customerPhone", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-e");
    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);

    const noName = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ items: [{ menuItemId: item.body.data._id, quantity: 1 }] });
    expect(noName.status).toBe(400);

    const noPhone = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });
    expect(noPhone.status).toBe(201);
  });

  it("two independent customer sessions at the same table cannot see each other's orders (§57)", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-f");
    const { item, table } = await setUpMenuAndSession(app, accessToken);

    const sessionA = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });
    const sessionB = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });

    const orderA = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionA.body.data.sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

    const crossRead = await request(app)
      .get(`/api/v1/customer/orders/${orderA.body.data._id}`)
      .set("Authorization", `Bearer ${sessionB.body.data.sessionToken}`);
    expect(crossRead.status).toBe(404);

    const ownRead = await request(app)
      .get(`/api/v1/customer/orders/${orderA.body.data._id}`)
      .set("Authorization", `Bearer ${sessionA.body.data.sessionToken}`);
    expect(ownRead.status).toBe(200);

    const status = await request(app)
      .get(`/api/v1/customer/orders/${orderA.body.data._id}/status`)
      .set("Authorization", `Bearer ${sessionA.body.data.sessionToken}`);
    expect(status.status).toBe(200);
    expect(status.body.data.orderStatus).toBe("PENDING_PAYMENT");
  });

  it("order numbers are sequential per branch and menu name/price are snapshotted historically", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("order-g");
    const { item, sessionToken } = await setUpMenuAndSession(app, accessToken);

    const first = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "A", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });
    const second = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({ customerName: "B", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber + 1);

    // change the menu item's price after the order was placed
    await request(app)
      .put(`/api/v1/admin/menu-items/${item.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ price: 999, name: "Renamed Item" });

    const { Order } = await import("../src/models/Order.js");
    const stored = await Order.findById(first.body.data._id);
    expect(stored?.items[0]?.unitPrice).toBe(150);
    expect(stored?.items[0]?.name).toBe("Cappuccino");
  });
});
