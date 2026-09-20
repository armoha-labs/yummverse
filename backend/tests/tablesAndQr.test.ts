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

describe("table management & QR", () => {
  it("creates a table, regenerates its QR (invalidating the old token), and enforces unique table numbers", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("table-a");

    const created = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "1" });
    expect(created.status).toBe(201);
    const originalToken = created.body.data.qrToken as string;

    const duplicate = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "1" });
    expect(duplicate.status).toBe(409);

    const regenerated = await request(app)
      .post(`/api/v1/admin/tables/${created.body.data._id}/qr/regenerate`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.qrToken).not.toBe(originalToken);

    // the old token no longer resolves publicly
    const oldLookup = await request(app).get(`/api/v1/public/tables/${originalToken}`);
    expect(oldLookup.status).toBe(404);

    const newLookup = await request(app).get(`/api/v1/public/tables/${regenerated.body.data.qrToken}`);
    expect(newLookup.status).toBe(200);
    expect(newLookup.body.data.table.tableNumber).toBe("1");
  });

  it("serves a scannable PNG for a single table and a bulk PDF export for all tables", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("table-b");
    const t1 = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "1" });
    await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "2" });

    const png = await request(app)
      .get(`/api/v1/admin/tables/${t1.body.data._id}/qr`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(png.status).toBe(200);
    expect(png.headers["content-type"]).toBe("image/png");
    expect(png.body.length).toBeGreaterThan(100);

    const pdf = await request(app)
      .get("/api/v1/admin/tables/qr/export")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.body.length).toBeGreaterThan(100);
  });

  it("blocks deleting a table that has an active order", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("table-c");
    const created = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "5" });

    const { Table } = await import("../src/models/Table.js");
    const { Types } = await import("mongoose");
    await Table.updateOne({ _id: created.body.data._id }, { currentOrderId: new Types.ObjectId() });

    const del = await request(app)
      .delete(`/api/v1/admin/tables/${created.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(del.status).toBe(409);
  });
});

describe("public QR flow and customer sessions", () => {
  it("a valid QR resolves table/branch/tenant info and can start a customer session", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("qr-a");
    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "9" });
    const qrToken = table.body.data.qrToken as string;

    const resolved = await request(app).get(`/api/v1/public/tables/${qrToken}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.table.tableNumber).toBe("9");
    expect(resolved.body.data.tenant.slug).toBe("qr-a");

    const session = await request(app).post("/api/v1/customer/session").send({ qrToken });
    expect(session.status).toBe(201);
    expect(session.body.data.sessionToken).toBeDefined();
    expect(session.body.data.tableId).toBe(table.body.data._id);

    const tableAfter = await request(app)
      .get(`/api/v1/admin/tables/${table.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(tableAfter.body.data.status).toBe("OCCUPIED");
  });

  it("with table status tracking disabled, scanning a QR never flips the table to OCCUPIED", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("qr-c");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ordering: { tableStatusEnabled: false } });

    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "9" });
    const qrToken = table.body.data.qrToken as string;

    const resolved = await request(app).get(`/api/v1/public/tables/${qrToken}`);
    expect(resolved.body.data.table.status).toBe("AVAILABLE");

    await request(app).post("/api/v1/customer/session").send({ qrToken });

    const tableAfter = await request(app)
      .get(`/api/v1/admin/tables/${table.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(tableAfter.body.data.status).toBe("AVAILABLE");
  });

  it("a branch-level override re-enables table status tracking for that branch even with the tenant default off", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("qr-d");
    await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ordering: { tableStatusEnabled: false } });
    await request(app)
      .put(`/api/v1/admin/branches/${defaultBranch._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { ordering: { tableStatusEnabled: true } } });

    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "10" });
    await request(app).post("/api/v1/customer/session").send({ qrToken: table.body.data.qrToken });

    const tableAfter = await request(app)
      .get(`/api/v1/admin/tables/${table.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(tableAfter.body.data.status).toBe("OCCUPIED");
  });

  it("an unknown QR token returns 404, never leaking tenant existence", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/public/tables/not-a-real-token");
    expect(res.status).toBe(404);
  });

  it("a suspended tenant's QR reports the café as unavailable rather than resolving normally", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("qr-b");
    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "3" });

    await Tenant.updateOne({ _id: tenant._id }, { status: "SUSPENDED" });

    const resolved = await request(app).get(`/api/v1/public/tables/${table.body.data.qrToken}`);
    expect(resolved.status).toBe(403);
    expect(resolved.body.error.code).toBe("TENANT_UNAVAILABLE");

    const session = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });
    expect(session.status).toBe(403);
  });
});
