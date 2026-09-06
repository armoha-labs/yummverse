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

  // PRO plan (5 branches, §47) — these tests exercise multi-branch behavior.
  const { tenant, branch, admin, inviteToken } = await tenantService.createTenant(
    { name: slug, slug, adminName: "Admin", adminEmail: `admin@${slug}.test`, planId: "PRO" },
    { platformAdminId: platformAdmin._id.toString() },
  );

  const app = createApp();
  await request(app)
    .post("/api/v1/auth/accept-invite")
    .send({ tenantSlug: slug, email: admin.email, inviteToken, newPassword: "AdminPass123!" });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ tenantSlug: slug, email: admin.email, password: "AdminPass123!" });

  return { app, tenant, defaultBranch: branch, accessToken: login.body.data.accessToken as string };
}

describe("branch management", () => {
  it("every tenant starts with exactly one default branch that cannot be deactivated", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("branch-a");

    const list = await request(app)
      .get("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].isDefault).toBe(true);

    const deactivate = await request(app)
      .post(`/api/v1/admin/branches/${defaultBranch._id.toString()}/deactivate`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deactivate.status).toBe(400);
  });

  it("can add a second branch with a unique slug and reject a duplicate", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("branch-b");

    const created = await request(app)
      .post("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Indiranagar", slug: "indiranagar" });
    expect(created.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Indiranagar Again", slug: "indiranagar" });
    expect(duplicate.status).toBe(409);

    const list = await request(app)
      .get("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data).toHaveLength(2);
  });

  it("updates branch tax/service-charge settings independently of the tenant default", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("branch-c");

    const updated = await request(app)
      .put(`/api/v1/admin/branches/${defaultBranch._id.toString()}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ settings: { tax: { enabled: true, percentage: 5 } } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.settings.tax).toEqual({ enabled: true, percentage: 5 });
    // untouched sibling stays unset — it still inherits the tenant default (§6A.2), not a
    // silently-materialized "disabled" override
    expect(updated.body.data.settings.serviceCharge).toBeUndefined();
  });

  it("a non-deactivatable second branch can be deactivated normally", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("branch-d");
    const created = await request(app)
      .post("/api/v1/admin/branches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Second", slug: "second" });

    const deactivated = await request(app)
      .post(`/api/v1/admin/branches/${created.body.data._id}/deactivate`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.status).toBe("INACTIVE");
  });
});
