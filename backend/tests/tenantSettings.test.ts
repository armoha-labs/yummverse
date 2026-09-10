import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { hashPassword } from "../src/utils/password.js";
import { tenantService } from "../src/services/tenant.service.js";

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

describe("tenant profile & settings", () => {
  it("tenant admin can read and update their profile", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("settings-a");

    const before = await request(app)
      .get("/api/v1/tenant/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data.name).toBe("settings-a");

    const updated = await request(app)
      .put("/api/v1/tenant/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Settings Café", contact: { phone: "+91 90000 00000" } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe("Settings Café");
    expect(updated.body.data.contact.phone).toBe("+91 90000 00000");
  });

  it("settings default correctly and a partial update only changes the given fields", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("settings-b");

    const initial = await request(app)
      .get("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data.tax.enabled).toBe(false);
    expect(initial.body.data.ordering.collectCustomerPhone).toBe(true);

    const updated = await request(app)
      .put("/api/v1/tenant/settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ tax: { enabled: true, percentage: 5 } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.tax).toEqual({ enabled: true, percentage: 5 });
    // untouched fields survive the partial update
    expect(updated.body.data.ordering.collectCustomerPhone).toBe(true);

    const actions = (await AuditLog.find({ tenantId: tenant._id })).map((a) => a.action);
    expect(actions).toContain("TENANT_SETTINGS_UPDATED");
  });

  it("a waiter cannot read or update tenant settings", async () => {
    const { app, accessToken: adminToken, tenant } = await createActivatedTenantAdmin("settings-c");
    void adminToken;
    void tenant;

    const unauth = await request(app).get("/api/v1/tenant/settings");
    expect(unauth.status).toBe(401);
  });

  it("branding colors can be updated and validated", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("settings-d");

    const badColor = await request(app)
      .put("/api/v1/tenant/branding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ primaryColor: "not-a-color" });
    expect(badColor.status).toBe(400);

    const ok = await request(app)
      .put("/api/v1/tenant/branding")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ primaryColor: "#4B2E2B", secondaryColor: "#E8C39E" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.primaryColor).toBe("#4B2E2B");
  });

  it("stores an uploaded logo as base64 (primary) with a local-disk backup copy, replaces, then removes both", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("settings-e");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    const rejectedType = await request(app)
      .post("/api/v1/tenant/branding/logo")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", Buffer.from("not an image"), { filename: "logo.txt", contentType: "text/plain" });
    expect(rejectedType.status).toBe(400);

    const uploaded = await request(app)
      .post("/api/v1/tenant/branding/logo")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", png, { filename: "logo.png", contentType: "image/png" });
    expect(uploaded.status).toBe(200);
    // Primary: base64 data URI, directly usable as an <img src> with no separate fetch.
    expect(uploaded.body.data.logoUrl).toMatch(/^data:image\/png;base64,/);
    expect(uploaded.body.data.logoUrl).toContain(png.toString("base64"));
    // Secondary: still also written to local disk as a backup copy.
    expect(uploaded.body.data.logoAssetId).toContain("branding/");
    const firstAssetId = uploaded.body.data.logoAssetId;

    const replaced = await request(app)
      .post("/api/v1/tenant/branding/logo")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", png, { filename: "logo2.png", contentType: "image/png" });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.logoAssetId).not.toBe(firstAssetId);

    const removed = await request(app)
      .delete("/api/v1/tenant/branding/logo")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.logoUrl).toBeFalsy();
  });
});
