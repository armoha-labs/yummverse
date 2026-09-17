import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword } from "../src/utils/password.js";

async function createActivatedTenantAdmin(slug: string) {
  const passwordHash = await hashPassword("PlatformPass123!");
  const platformAdmin = await PlatformAdmin.create({
    name: "Root",
    email: `${slug}-root@yummverse.test`,
    passwordHash,
  });

  const { tenant, admin, inviteToken } = await tenantService.createTenant(
    { name: slug, slug, adminName: "Admin", adminEmail: `admin@${slug}.test` },
    { platformAdminId: platformAdmin._id.toString() },
  );

  const app = createApp();
  await request(app)
    .post("/api/v1/auth/accept-invite")
    .send({ tenantSlug: slug, email: admin.email, inviteToken, newPassword: "AdminPass123!" });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ tenantSlug: slug, email: admin.email, password: "AdminPass123!" });

  return { app, tenant, accessToken: login.body.data.accessToken as string };
}

describe("menu bulk export/import", () => {
  it("exports categories and items as one flattened CSV sheet", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menubulk-a");

    const cat = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Beverages" });
    await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: cat.body.data._id, name: "Filter Coffee", price: 50, taxPercentage: 5 });

    const res = await request(app)
      .get("/api/v1/admin/menu-items/export?format=csv")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const text = res.text;
    expect(text).toContain("Category,Item Name,Description,Price,GST %,Available");
    expect(text).toContain("Beverages,Filter Coffee,,50,5,Yes");
  });

  it("imports a CSV, creating a new category and item, and updating an existing item by name match", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menubulk-b");

    const cat = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Beverages" });
    const item = await request(app)
      .post("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: cat.body.data._id, name: "Filter Coffee", price: 50, taxPercentage: 5 });

    const csv = [
      "Category,Item Name,Description,Price,GST %,Available",
      "Beverages,Filter Coffee,,60,5,No", // update: price + availability
      "Snacks,Samosa,,20,5,Yes", // new category + new item
    ].join("\n");

    const res = await request(app)
      .post("/api/v1/admin/menu-items/import")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from(csv), { filename: "menu.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.categoriesCreated).toBe(1);
    expect(res.body.data.itemsCreated).toBe(1);
    expect(res.body.data.itemsUpdated).toBe(1);
    expect(res.body.data.errors).toEqual([]);

    const items = await request(app)
      .get("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`);
    const filterCoffee = items.body.data.find((i: { _id: string }) => i._id === item.body.data._id);
    expect(filterCoffee.price).toBe(60);
    expect(filterCoffee.isAvailable).toBe(false);
    const samosa = items.body.data.find((i: { name: string }) => i.name === "Samosa");
    expect(samosa).toBeDefined();
    expect(samosa.price).toBe(20);

    const categories = await request(app)
      .get("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(categories.body.data.some((c: { name: string }) => c.name === "Snacks")).toBe(true);
  });

  it("skips invalid rows with a per-row error instead of failing the whole import", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menubulk-c");

    const csv = [
      "Category,Item Name,Description,Price,GST %,Available",
      "Beverages,Bad Price Item,,not-a-number,5,Yes",
      "Beverages,Bad Gst Item,,20,150,Yes",
      "Beverages,Good Item,,25,5,Yes",
    ].join("\n");

    const res = await request(app)
      .post("/api/v1/admin/menu-items/import")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from(csv), { filename: "menu.csv", contentType: "text/csv" });

    expect(res.status).toBe(200);
    expect(res.body.data.itemsCreated).toBe(1);
    expect(res.body.data.errors).toHaveLength(2);
    expect(res.body.data.errors[0].row).toBe(2);
    expect(res.body.data.errors[1].row).toBe(3);

    const items = await request(app)
      .get("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(items.body.data).toHaveLength(1);
    expect(items.body.data[0].name).toBe("Good Item");
  });

  it("re-importing the same file twice doesn't duplicate the item", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("menubulk-d");

    const csv = ["Category,Item Name,Description,Price,GST %,Available", "Beverages,Filter Coffee,,50,5,Yes"].join(
      "\n",
    );

    await request(app)
      .post("/api/v1/admin/menu-items/import")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from(csv), { filename: "menu.csv", contentType: "text/csv" });
    const second = await request(app)
      .post("/api/v1/admin/menu-items/import")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from(csv), { filename: "menu.csv", contentType: "text/csv" });

    expect(second.body.data.categoriesCreated).toBe(0);
    expect(second.body.data.itemsCreated).toBe(0);
    expect(second.body.data.itemsUpdated).toBe(1);

    const items = await request(app)
      .get("/api/v1/admin/menu-items")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(items.body.data).toHaveLength(1);
  });
});
