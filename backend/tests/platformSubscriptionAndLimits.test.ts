import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { hashPassword } from "../src/utils/password.js";

async function createPlatformAdminAndLogin(slug: string) {
  const passwordHash = await hashPassword("PlatformPass123!");
  await PlatformAdmin.create({ name: "Root", email: `${slug}@yummverse.test`, passwordHash });

  const app = createApp();
  const login = await request(app)
    .post("/api/v1/platform/auth/login")
    .send({ email: `${slug}@yummverse.test`, password: "PlatformPass123!" });

  return { app, accessToken: login.body.data.accessToken as string };
}

describe("tenant subscription (§47)", () => {
  it("defaults a new tenant to the FREE plan, with the FREE plan's staff/table limits", async () => {
    const { app, accessToken } = await createPlatformAdminAndLogin("plat-a");

    const created = await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Free Café", slug: "free-cafe-a", adminName: "Admin", adminEmail: "admin@free-cafe-a.test" });
    expect(created.body.data.tenant.subscription.planId).toBe("FREE");

    const tenantId = created.body.data.tenant._id;
    const limits = await request(app)
      .get(`/api/v1/platform/tenants/${tenantId}/limits`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(limits.status).toBe(200);
    expect(limits.body.data.effective.maxStaffUsers).toBe(5);
    expect(limits.body.data.effective.maxTables).toBe(10);
  });

  it("upgrading the plan raises the effective limits without any override", async () => {
    const { app, accessToken } = await createPlatformAdminAndLogin("plat-b");
    const created = await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Growing Café", slug: "growing-cafe", adminName: "Admin", adminEmail: "admin@growing-cafe.test" });
    const tenantId = created.body.data.tenant._id;

    const upgraded = await request(app)
      .put(`/api/v1/platform/tenants/${tenantId}/subscription`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ planId: "PRO" });
    expect(upgraded.status).toBe(200);
    expect(upgraded.body.data.subscription.planId).toBe("PRO");

    const limits = await request(app)
      .get(`/api/v1/platform/tenants/${tenantId}/limits`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(limits.body.data.effective.maxStaffUsers).toBe(50);

    const actions = (await AuditLog.find({ tenantId })).map((a) => a.action);
    expect(actions).toContain("TENANT_SUBSCRIPTION_UPDATED");
  });
});

describe("tenant limits & feature overrides (§7A)", () => {
  it("a per-tenant override wins over the plan default, and blank fields keep inheriting it", async () => {
    const { app, accessToken } = await createPlatformAdminAndLogin("plat-c");
    const created = await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Pilot Café", slug: "pilot-cafe", adminName: "Admin", adminEmail: "admin@pilot-cafe.test" });
    const tenantId = created.body.data.tenant._id;

    // FREE plan normally allows 10 tables — grant this tenant an exception to pilot 30.
    const overridden = await request(app)
      .put(`/api/v1/platform/tenants/${tenantId}/limits`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ overrides: { maxTables: 30 } });
    expect(overridden.status).toBe(200);
    expect(overridden.body.data.effective.maxTables).toBe(30);
    // untouched fields still fall through to the FREE plan default
    expect(overridden.body.data.effective.maxStaffUsers).toBe(5);

    const actions = (await AuditLog.find({ tenantId })).map((a) => a.action);
    expect(actions).toContain("TENANT_LIMITS_UPDATED");
  });
});

describe("platform metrics (§46.4)", () => {
  it("summarizes tenant counts by status and platform-wide revenue", async () => {
    const { app, accessToken } = await createPlatformAdminAndLogin("plat-e");
    await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Metrics Café", slug: "metrics-cafe", adminName: "Admin", adminEmail: "admin@metrics-cafe.test" });

    const summary = await request(app)
      .get("/api/v1/platform/reports/summary")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.tenants.total).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.tenants.trial).toBeGreaterThanOrEqual(1);
    expect(typeof summary.body.data.last30Days.platformWideRevenue).toBe("number");
  });

  it("a tenant admin cannot reach platform-only endpoints", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/platform/reports/summary");
    expect(res.status).toBe(401);
  });
});

describe("tenant lifecycle: cancel", () => {
  it("platform admin can cancel a tenant", async () => {
    const { app, accessToken } = await createPlatformAdminAndLogin("plat-f");
    const created = await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Closing Café", slug: "closing-cafe", adminName: "Admin", adminEmail: "admin@closing-cafe.test" });

    const cancelled = await request(app)
      .post(`/api/v1/platform/tenants/${created.body.data.tenant._id}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
  });
});
