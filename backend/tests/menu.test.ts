import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
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

describe("category & menu item management", () => {
  it("creates categories and items, and enforces the item belongs to a real category", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("menu-a");

    const category = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Coffee" });
    expect(category.status).toBe(201);

    const badItem = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: "000000000000000000000000", name: "Ghost Item", price: 100 });
    expect(badItem.status).toBe(404);

    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.body.data._id, name: "Cappuccino", price: 150, taxPercentage: 5 });
    expect(item.status).toBe(201);
    expect(item.body.data.isAvailable).toBe(true);

    const actions = (await AuditLog.find({ tenantId: tenant._id })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["CATEGORY_CREATED", "MENU_ITEM_CREATED"]));
  });

  it("changing price emits PRICE_CHANGED in addition to MENU_ITEM_UPDATED", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("menu-b");
    const category = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Coffee" });
    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.body.data._id, name: "Latte", price: 120 });

    await request(app)
      .put(`/api/v1/admin/menu-items/${item.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ description: "Smooth and creamy" }); // no price change

    await request(app)
      .put(`/api/v1/admin/menu-items/${item.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ price: 140 });

    const actions = (await AuditLog.find({ tenantId: tenant._id, entityType: "MenuItem" })).map(
      (a) => a.action,
    );
    expect(actions.filter((a) => a === "PRICE_CHANGED")).toHaveLength(1);
    expect(actions.filter((a) => a === "MENU_ITEM_UPDATED")).toHaveLength(2);
  });

  it("the one-click availability toggle works independently of a full edit", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menu-c");
    const category = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Coffee" });
    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.body.data._id, name: "Espresso", price: 100 });

    const toggled = await request(app)
      .patch(`/api/v1/admin/menu-items/${item.body.data._id}/availability`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isAvailable: false });
    expect(toggled.status).toBe(200);
    expect(toggled.body.data.isAvailable).toBe(false);
  });

  it("deleting a category cascade-deactivates its items rather than orphaning them", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menu-d");
    const category = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Desserts" });
    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.body.data._id, name: "Brownie", price: 90 });

    const del = await request(app)
      .delete(`/api/v1/admin/categories/${category.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(del.status).toBe(200);

    const { MenuItem } = await import("../src/models/MenuItem.js");
    const refetched = await MenuItem.findById(item.body.data._id);
    expect(refetched?.active).toBe(false);
  });

  it("reorders categories by the given id sequence", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menu-e");
    const a = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "A" });
    const b = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "B" });

    await request(app)
      .put("/api/v1/admin/categories/reorder")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderedIds: [b.body.data._id, a.body.data._id] });

    const list = await request(app)
      .get("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`);
    const names = list.body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual(["B", "A"]);
  });
});

describe("branch menu availability overrides (§6A.4)", () => {
  it("a branch override marks an item unavailable at that branch without touching the shared menu", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("menu-f");
    const category = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Coffee" });
    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: category.body.data._id, name: "Mocha", price: 160 });

    const branchId = defaultBranch._id.toString();
    const override = await request(app)
      .put(`/api/v1/admin/menu-items/${item.body.data._id}/branch-overrides/${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ isAvailable: false });
    expect(override.status).toBe(200);

    // the master menu item is untouched
    const masterItem = await request(app)
      .get(`/api/v1/admin/menu-items?categoryId=${category.body.data._id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(masterItem.body.data[0].isAvailable).toBe(true);

    // but the customer-facing menu for this branch reflects the override
    const table = await request(app)
      .post("/api/v1/admin/tables")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tableNumber: "1" });
    const session = await request(app)
      .post("/api/v1/customer/session")
      .send({ qrToken: table.body.data.qrToken });
    const sessionToken = session.body.data.sessionToken;

    const publicMenu = await request(app)
      .get("/api/v1/public/menu")
      .set("Authorization", `Bearer ${sessionToken}`);
    expect(publicMenu.status).toBe(200);
    const mocha = publicMenu.body.data.find((i: { name: string }) => i.name === "Mocha");
    expect(mocha.isAvailable).toBe(false);
    expect(mocha.categoryId).toBe(category.body.data._id);
  });

  it("public categories and menu require a customer session, never trusting a bare tenant id", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/public/menu");
    expect(res.status).toBe(401);
  });
});
