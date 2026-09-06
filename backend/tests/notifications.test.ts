import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { DeviceToken } from "../src/models/DeviceToken.js";
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

describe("push notification device registration (§40A.3)", () => {
  it("registers a staff device scoped to tenant+branch from the JWT, never the body", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("push-a");

    const res = await request(app)
      .post("/api/v1/notifications/register-token")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ platform: "WEB", fcmToken: "staff-token-1" });
    expect(res.status).toBe(200);

    const stored = await DeviceToken.findOne({ fcmToken: "staff-token-1" });
    expect(stored?.tenantId.toString()).toBe(tenant._id.toString());
    expect(stored?.ownerType).toBe("USER");
  });

  it("registers a customer session device and can deregister it", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("push-b");
    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "1" });
    const session = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });

    const register = await request(app)
      .post("/api/v1/notifications/register-token")
      .set("Authorization", `Bearer ${session.body.data.sessionToken}`)
      .send({ platform: "WEB", fcmToken: "customer-token-1" });
    expect(register.status).toBe(200);

    const stored = await DeviceToken.findOne({ fcmToken: "customer-token-1" });
    expect(stored?.ownerType).toBe("CUSTOMER_SESSION");

    const deregister = await request(app)
      .delete("/api/v1/notifications/register-token")
      .set("Authorization", `Bearer ${session.body.data.sessionToken}`)
      .send({ fcmToken: "customer-token-1" });
    expect(deregister.status).toBe(200);
    expect(await DeviceToken.findOne({ fcmToken: "customer-token-1" })).toBeNull();
  });

  it("rejects registration without any valid credential", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/notifications/register-token")
      .send({ platform: "WEB", fcmToken: "no-auth-token" });
    expect(res.status).toBe(401);
  });

  it("order lifecycle transitions succeed even though FCM isn't configured (logs instead of sending)", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("push-c");
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
      .send({ tableNumber: "2" });
    const session = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });
    const order = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${session.body.data.sessionToken}`)
      .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

    const { Order } = await import("../src/models/Order.js");
    await Order.updateOne({ _id: order.body.data._id }, { orderStatus: "NEW", paymentStatus: "PAID" });

    const accept = await request(app)
      .post(`/api/v1/admin/kitchen/orders/${order.body.data._id}/accept`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(accept.status).toBe(200); // would throw/500 if the fire-and-forget notify call blew up sync
  });
});
