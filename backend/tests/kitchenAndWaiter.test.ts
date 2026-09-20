import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { User } from "../src/models/User.js";
import { Order } from "../src/models/Order.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword, hashToken } from "../src/utils/password.js";

async function createActivatedTenantAdmin(slug: string) {
  const passwordHash = await hashPassword("PlatformPass123!");
  const platformAdmin = await PlatformAdmin.create({
    name: "Root",
    email: `${slug}-root@yummverse.test`,
    passwordHash,
  });

  // PRO plan (5 branches, §47) — one test here exercises cross-branch isolation.
  const { tenant, branch, admin, inviteToken } = await tenantService.createTenant(
    { name: slug, slug, adminName: "Admin", adminEmail: `admin@${slug}.test`, planId: "PRO" },
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

async function createStaffAndLogin(
  app: ReturnType<typeof createApp>,
  slug: string,
  adminToken: string,
  branchId: string,
  role: "WAITER" | "KITCHEN",
  email: string,
) {
  const created = await request(app)
    .post("/api/v1/admin/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: role, email, role, branchId });

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

async function setUpNewOrder(app: ReturnType<typeof createApp>, accessToken: string, branchId?: string) {
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
    .send(branchId ? { tableNumber: "1", branchId } : { tableNumber: "1" });
  const session = await request(app)
    .post("/api/v1/customer/session")
    .send({ qrToken: table.body.data.qrToken });
  const order = await request(app)
    .post("/api/v1/customer/orders")
    .set("Authorization", `Bearer ${session.body.data.sessionToken}`)
    .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

  // Bypass the payment flow (already covered in payments.test.ts) to reach NEW directly.
  await Order.updateOne({ _id: order.body.data._id }, { orderStatus: "NEW", paymentStatus: "PAID" });

  return { orderId: order.body.data._id as string, table };
}

describe("kitchen order lifecycle", () => {
  it("walks NEW -> ACCEPTED -> PREPARING -> READY and rejects an out-of-order transition", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-a");
    const { orderId } = await setUpNewOrder(app, accessToken);
    const kitchenToken = await createStaffAndLogin(
      app,
      "kw-a",
      accessToken,
      defaultBranch._id.toString(),
      "KITCHEN",
      "kitchen@kw-a.test",
    );
    void tenant;

    const queueBefore = await request(app).get("/api/v1/kitchen/orders").set("Authorization", `Bearer ${kitchenToken}`);
    expect(queueBefore.body.data.map((o: { _id: string }) => o._id)).toContain(orderId);

    const accept = await request(app)
      .post(`/api/v1/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${kitchenToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.orderStatus).toBe("ACCEPTED");
    expect(accept.body.data.acceptedAt).toBeTruthy();

    const acceptAgain = await request(app)
      .post(`/api/v1/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${kitchenToken}`);
    expect(acceptAgain.status).toBe(409);

    await request(app).post(`/api/v1/kitchen/orders/${orderId}/preparing`).set("Authorization", `Bearer ${kitchenToken}`);
    const ready = await request(app)
      .post(`/api/v1/kitchen/orders/${orderId}/ready`)
      .set("Authorization", `Bearer ${kitchenToken}`);
    expect(ready.status).toBe(200);
    expect(ready.body.data.orderStatus).toBe("READY");
  });

  it("the kitchen queue shows the table number, not just an id (§10's 'view table number')", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-g");
    const { orderId, table } = await setUpNewOrder(app, accessToken);
    const kitchenToken = await createStaffAndLogin(
      app,
      "kw-g",
      accessToken,
      defaultBranch._id.toString(),
      "KITCHEN",
      "kitchen@kw-g.test",
    );

    const queue = await request(app).get("/api/v1/kitchen/orders").set("Authorization", `Bearer ${kitchenToken}`);
    const order = queue.body.data.find((o: { _id: string }) => o._id === orderId);
    expect(order.tableId.tableNumber).toBe(table.body.data.tableNumber);
  });

  it("a kitchen user cannot see or act on another branch's orders (§6A.5)", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-b");
    const { orderId } = await setUpNewOrder(app, accessToken, defaultBranch._id.toString());

    const secondBranch = await request(app)
      .post("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Second", slug: "second" });
    const otherKitchenToken = await createStaffAndLogin(
      app,
      "kw-b",
      accessToken,
      secondBranch.body.data._id,
      "KITCHEN",
      "otherkitchen@kw-b.test",
    );

    const queue = await request(app)
      .get("/api/v1/kitchen/orders")
      .set("Authorization", `Bearer ${otherKitchenToken}`);
    expect(queue.body.data.map((o: { _id: string }) => o._id)).not.toContain(orderId);

    const blockedAccept = await request(app)
      .post(`/api/v1/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${otherKitchenToken}`);
    expect(blockedAccept.status).toBe(404);
  });

  it("tenant admin has read + action parity across all branches via /admin/kitchen", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("kw-c");
    const { orderId } = await setUpNewOrder(app, accessToken);

    const adminQueue = await request(app)
      .get("/api/v1/admin/kitchen/orders")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(adminQueue.body.data.map((o: { _id: string }) => o._id)).toContain(orderId);

    const accept = await request(app)
      .post(`/api/v1/admin/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.orderStatus).toBe("ACCEPTED");
  });
});

describe("waiter workflow", () => {
  it("sees the occupied table and active orders, and can mark a READY order SERVED", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-d");
    const { orderId, table } = await setUpNewOrder(app, accessToken);
    const kitchenToken = await createStaffAndLogin(
      app,
      "kw-d",
      accessToken,
      defaultBranch._id.toString(),
      "KITCHEN",
      "kitchen@kw-d.test",
    );
    await request(app).post(`/api/v1/kitchen/orders/${orderId}/accept`).set("Authorization", `Bearer ${kitchenToken}`);
    await request(app).post(`/api/v1/kitchen/orders/${orderId}/preparing`).set("Authorization", `Bearer ${kitchenToken}`);
    await request(app).post(`/api/v1/kitchen/orders/${orderId}/ready`).set("Authorization", `Bearer ${kitchenToken}`);

    const waiterToken = await createStaffAndLogin(
      app,
      "kw-d",
      accessToken,
      defaultBranch._id.toString(),
      "WAITER",
      "waiter@kw-d.test",
    );

    const tables = await request(app).get("/api/v1/waiter/tables").set("Authorization", `Bearer ${waiterToken}`);
    const seenTable = tables.body.data.find((t: { _id: string }) => t._id === table.body.data._id);
    expect(seenTable.status).toBe("OCCUPIED");

    const orders = await request(app).get("/api/v1/waiter/orders").set("Authorization", `Bearer ${waiterToken}`);
    expect(orders.body.data.map((o: { _id: string }) => o._id)).toContain(orderId);

    const notReadyServe = await request(app)
      .post(`/api/v1/waiter/orders/${orderId}/served`)
      .set("Authorization", `Bearer ${waiterToken}`);
    // it IS ready at this point, so this should succeed
    expect(notReadyServe.status).toBe(200);
    expect(notReadyServe.body.data.orderStatus).toBe("SERVED");

    // serving an already-served order is rejected
    const again = await request(app)
      .post(`/api/v1/waiter/orders/${orderId}/served`)
      .set("Authorization", `Bearer ${waiterToken}`);
    expect(again.status).toBe(409);
  });

  it("with kitchen disabled, accept/preparing/ready are rejected and a waiter can serve a NEW order directly", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-h");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ordering: { kitchenEnabled: false } });

    const { orderId } = await setUpNewOrder(app, accessToken);
    const kitchenToken = await createStaffAndLogin(
      app,
      "kw-h",
      accessToken,
      defaultBranch._id.toString(),
      "KITCHEN",
      "kitchen@kw-h.test",
    );
    const waiterToken = await createStaffAndLogin(
      app,
      "kw-h",
      accessToken,
      defaultBranch._id.toString(),
      "WAITER",
      "waiter@kw-h.test",
    );

    const blockedAccept = await request(app)
      .post(`/api/v1/kitchen/orders/${orderId}/accept`)
      .set("Authorization", `Bearer ${kitchenToken}`);
    expect(blockedAccept.status).toBe(400);
    expect(blockedAccept.body.error.code).toBe("KITCHEN_DISABLED");

    const served = await request(app)
      .post(`/api/v1/waiter/orders/${orderId}/served`)
      .set("Authorization", `Bearer ${waiterToken}`);
    expect(served.status).toBe(200);
    expect(served.body.data.orderStatus).toBe("SERVED");
    // Skipped straight from NEW to SERVED — no kitchen stage timestamps were ever set.
    expect(served.body.data.acceptedAt).toBeFalsy();
    expect(served.body.data.preparingAt).toBeFalsy();
    expect(served.body.data.readyAt).toBeFalsy();
  });

  it("the QR/waiter/kitchen lookups report kitchenEnabled, and a branch override beats the tenant default", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-i");
    const { table } = await setUpNewOrder(app, accessToken);
    const branchId = defaultBranch._id.toString();
    const waiterToken = await createStaffAndLogin(app, "kw-i", accessToken, branchId, "WAITER", "waiter@kw-i.test");
    const kitchenToken = await createStaffAndLogin(app, "kw-i", accessToken, branchId, "KITCHEN", "kitchen@kw-i.test");

    const qrBefore = await request(app).get(`/api/v1/public/tables/${table.body.data.qrToken}`);
    expect(qrBefore.body.data.branch.kitchenEnabled).toBe(true);
    const waiterBefore = await request(app).get("/api/v1/waiter/settings").set("Authorization", `Bearer ${waiterToken}`);
    expect(waiterBefore.body.data).toEqual({ kitchenEnabled: true, tableStatusEnabled: true });
    const kitchenBefore = await request(app).get("/api/v1/kitchen/settings").set("Authorization", `Bearer ${kitchenToken}`);
    expect(kitchenBefore.body.data).toEqual({ kitchenEnabled: true });

    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ordering: { kitchenEnabled: false } });

    const qrAfter = await request(app).get(`/api/v1/public/tables/${table.body.data.qrToken}`);
    expect(qrAfter.body.data.branch.kitchenEnabled).toBe(false);
    const waiterAfter = await request(app).get("/api/v1/waiter/settings").set("Authorization", `Bearer ${waiterToken}`);
    expect(waiterAfter.body.data.kitchenEnabled).toBe(false);
    const kitchenAfter = await request(app).get("/api/v1/kitchen/settings").set("Authorization", `Bearer ${kitchenToken}`);
    expect(kitchenAfter.body.data.kitchenEnabled).toBe(false);

    // A branch-level override re-enables it for this branch only, beating the tenant-wide default.
    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { ordering: { kitchenEnabled: true } } });

    const qrOverride = await request(app).get(`/api/v1/public/tables/${table.body.data.qrToken}`);
    expect(qrOverride.body.data.branch.kitchenEnabled).toBe(true);
    const waiterOverride = await request(app).get("/api/v1/waiter/settings").set("Authorization", `Bearer ${waiterToken}`);
    expect(waiterOverride.body.data.kitchenEnabled).toBe(true);
    const kitchenOverride = await request(app).get("/api/v1/kitchen/settings").set("Authorization", `Bearer ${kitchenToken}`);
    expect(kitchenOverride.body.data.kitchenEnabled).toBe(true);
  });

  it("setting kitchenEnabled on a branch doesn't reset an already-set tableStatusEnabled override (and vice versa)", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-j");
    const branchId = defaultBranch._id.toString();

    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { ordering: { tableStatusEnabled: false } } });

    // Setting ONLY kitchenEnabled afterward must not silently reintroduce a tableStatusEnabled
    // override that was never asked for.
    await request(app)
      .put(`/api/v1/admin/branches/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { ordering: { kitchenEnabled: false } } });

    const branches = await request(app).get("/api/v1/admin/branches").set("Authorization", `Bearer ${accessToken}`);
    const branch = branches.body.data.find((b: { _id: string }) => b._id === branchId);
    expect(branch.settings.ordering.tableStatusEnabled).toBe(false);
    expect(branch.settings.ordering.kitchenEnabled).toBe(false);
  });

  it("waiter cannot create or modify a QR customer's order directly (no such endpoint is exposed)", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("kw-e");
    const waiterToken = await createStaffAndLogin(
      app,
      "kw-e",
      accessToken,
      defaultBranch._id.toString(),
      "WAITER",
      "waiter@kw-e.test",
    );

    const res = await request(app)
      .post("/api/v1/customer/orders")
      .set("Authorization", `Bearer ${waiterToken}`)
      .send({ customerName: "X", items: [] });
    // waiter's staff JWT is not a customer session, so this is rejected as unauthenticated
    // for the customer-session-scoped endpoint (Principle 5 — waiter doesn't place QR orders)
    expect(res.status).toBe(401);
  });
});
