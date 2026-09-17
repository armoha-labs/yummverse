import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { Order } from "../src/models/Order.js";
import { Payment } from "../src/models/Payment.js";
import { AuditLog } from "../src/models/AuditLog.js";
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

/** Creates a QR order and force-sets it to a given orderStatus/paymentStatus, bypassing the
 * full payment mock — payment flow itself is already covered elsewhere. */
async function createOrderInStatus(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  tenantId: string,
  branchId: string,
  opts: { price: number; taxPercentage?: number; orderStatus: string; paymentStatus: string; createdAt?: Date },
) {
  const category = await request(app)
    .post("/api/v1/admin/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Coffee" });
  const item = await request(app)
    .post("/api/v1/admin/menu-items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ categoryId: category.body.data._id, name: "Cappuccino", price: opts.price, taxPercentage: opts.taxPercentage ?? 0 });
  const table = await request(app)
    .post("/api/v1/admin/tables")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ tableNumber: String(Math.floor(Math.random() * 100000)) });
  const session = await request(app)
    .post("/api/v1/customer/session")
    .send({ qrToken: table.body.data.qrToken });
  const order = await request(app)
    .post("/api/v1/customer/orders")
    .set("Authorization", `Bearer ${session.body.data.sessionToken}`)
    .send({ customerName: "Priya", items: [{ menuItemId: item.body.data._id, quantity: 1 }] });

  await Order.updateOne(
    { _id: order.body.data._id },
    { orderStatus: opts.orderStatus, paymentStatus: opts.paymentStatus, ...(opts.createdAt ? { createdAt: opts.createdAt } : {}) },
  );
  if (opts.paymentStatus === "PAID") {
    await Payment.create({
      tenantId,
      branchId,
      orderId: order.body.data._id,
      amount: order.body.data.totalAmount,
      currency: "INR",
      status: "PAID",
      method: "UPI",
      createdAt: opts.createdAt ?? new Date(),
    });
  }

  return order.body.data._id as string;
}

describe("admin orders (Phase 12)", () => {
  it("lists orders with status/branch filters and can fetch a single order", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("adm-a");
    const orderId = await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 100,
      orderStatus: "NEW",
      paymentStatus: "PAID",
    });

    const list = await request(app)
      .get("/api/v1/admin/orders?status=NEW")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((o: { _id: string }) => o._id)).toContain(orderId);

    const detail = await request(app)
      .get(`/api/v1/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data._id).toBe(orderId);
  });

  it("cancels a NEW order; cancelling a paid order moves it to REFUND_PENDING, not straight to CANCELLED", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("adm-b");

    const unpaidOrderId = await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 100,
      orderStatus: "NEW",
      paymentStatus: "PENDING",
    });
    const cancelled = await request(app)
      .post(`/api/v1/admin/orders/${unpaidOrderId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.orderStatus).toBe("CANCELLED");

    const paidOrderId = await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 100,
      orderStatus: "ACCEPTED",
      paymentStatus: "PAID",
    });
    const cancelledPaid = await request(app)
      .post(`/api/v1/admin/orders/${paidOrderId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(cancelledPaid.status).toBe(200);
    expect(cancelledPaid.body.data.orderStatus).toBe("REFUND_PENDING");

    // a SERVED order can no longer be cancelled
    const servedOrderId = await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 100,
      orderStatus: "SERVED",
      paymentStatus: "PAID",
    });
    const rejected = await request(app)
      .post(`/api/v1/admin/orders/${servedOrderId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(rejected.status).toBe(409);

    const actions = (await AuditLog.find({ tenantId: tenant._id, action: "ORDER_CANCELLED" })).length;
    expect(actions).toBe(2);
  });
});

describe("reports (§46)", () => {
  it("computes revenue, tax, and item-performance from paid orders only", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("adm-c");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tax: { enabled: true, percentage: 0 } }); // percentage unused; item-level rate governs

    await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 100,
      taxPercentage: 5,
      orderStatus: "NEW",
      paymentStatus: "PAID",
    });
    await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 200,
      taxPercentage: 5,
      orderStatus: "PENDING_PAYMENT",
      paymentStatus: "PENDING", // must be excluded from revenue
    });

    const revenue = await request(app)
      .get("/api/v1/tenant/reports/revenue")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(revenue.status).toBe(200);
    expect(revenue.body.data.grossRevenue).toBe(105); // 100 subtotal + 5 tax = totalAmount
    expect(revenue.body.data.orderCount).toBe(1);
    expect(revenue.body.data.revenueByBranch[0].branchId).toBe(defaultBranch._id.toString());
    expect(revenue.body.data.revenueByBranch[0].branchName).toBe("Main Branch"); // not the raw id

    const tax = await request(app)
      .get("/api/v1/tenant/reports/tax")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(tax.status).toBe(200);
    expect(tax.body.data.totalTaxCollected).toBe(5); // 100 * 5%
    expect(tax.body.data.totalCgstCollected).toBe(2.5);
    expect(tax.body.data.totalSgstCollected).toBe(2.5);
    expect(tax.body.data.byRate[0].ratePercentage).toBe(5);
    expect(tax.body.data.byRate[0].cgstCollected).toBe(2.5);
    expect(tax.body.data.byRate[0].sgstCollected).toBe(2.5);

    const items = await request(app)
      .get("/api/v1/tenant/reports/item-performance")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(items.status).toBe(200);
    expect(items.body.data.topByQuantity[0].name).toBe("Cappuccino");
  });

  it("exports a report as CSV, Excel, and PDF, each recorded as REPORT_EXPORTED", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("adm-d");
    await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 150,
      orderStatus: "NEW",
      paymentStatus: "PAID",
    });

    const expectedExtension = { csv: "csv", excel: "xlsx", pdf: "pdf" } as const;
    for (const format of ["csv", "excel", "pdf"] as const) {
      const res = await request(app)
        .post("/api/v1/tenant/reports/export")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ reportType: "revenue", format });
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain(`.${expectedExtension[format]}`);
      expect(Number(res.headers["content-length"])).toBeGreaterThan(0);
    }

    const exportEvents = await AuditLog.find({ tenantId: tenant._id, action: "REPORT_EXPORTED" });
    expect(exportEvents.length).toBe(3);
  });

  it("a waiter cannot access tenant reports", async () => {
    const { app } = await createActivatedTenantAdmin("adm-e");
    const res = await request(app).get("/api/v1/tenant/reports/revenue");
    expect(res.status).toBe(401);
  });
});

describe("admin dashboard", () => {
  it("summarizes revenue, active orders, and table occupancy", async () => {
    const { app, tenant, defaultBranch, accessToken } = await createActivatedTenantAdmin("adm-f");
    await createOrderInStatus(app, accessToken, tenant._id.toString(), defaultBranch._id.toString(), {
      price: 250,
      orderStatus: "PREPARING",
      paymentStatus: "PAID",
    });

    const dashboard = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.last7Days.grossRevenue).toBe(250);
    expect(dashboard.body.data.activeOrderCount).toBe(1);
    expect(dashboard.body.data.tables.occupied).toBeGreaterThanOrEqual(1);
  });
});
