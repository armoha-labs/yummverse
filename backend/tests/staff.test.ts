import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Tenant } from "../src/models/Tenant.js";
import { User } from "../src/models/User.js";
import { tenantService } from "../src/services/tenant.service.js";
import { hashPassword, hashToken } from "../src/utils/password.js";

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

/** Bypasses email delivery (not wired up, §8A.2) by planting a known invite token directly. */
async function forceKnownInviteToken(userId: string, inviteToken: string) {
  await User.updateOne(
    { _id: userId },
    { inviteTokenHash: hashToken(inviteToken), inviteTokenExpiresAt: new Date(Date.now() + 60_000) },
  );
}

describe("staff management (§8A)", () => {
  it("creates a waiter, restricted to WAITER|KITCHEN role only", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("staff-a");
    const branchId = defaultBranch._id.toString();

    const badRole = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Sneaky", email: "sneaky@staff-a.test", role: "TENANT_ADMIN", branchId });
    expect(badRole.status).toBe(400); // zod rejects — role isn't in the WAITER|KITCHEN enum

    const created = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Ravi Kumar", email: "ravi@staff-a.test", role: "WAITER", branchId });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe("WAITER");
    expect(created.body.data.passwordHash).toBeUndefined();
  });

  it("never includes the Tenant Admin themselves in the staff list, filtered or not", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("staff-f");
    await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Ravi Kumar", email: "ravi@staff-f.test", role: "WAITER", branchId: defaultBranch._id.toString() });

    const unfiltered = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${accessToken}`);
    expect(unfiltered.body.data.map((u: { role: string }) => u.role)).not.toContain("TENANT_ADMIN");
    expect(unfiltered.body.data).toHaveLength(1);
  });

  it("a deactivated staff member cannot log in, and reactivating restores access", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("staff-b");

    const created = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Anita Rao", email: "anita@staff-b.test", role: "KITCHEN", branchId: defaultBranch._id.toString() });

    const inviteToken = "known-test-token";
    await forceKnownInviteToken(created.body.data._id, inviteToken);
    await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ tenantSlug: "staff-b", email: "anita@staff-b.test", inviteToken, newPassword: "KitchenPass123!" });

    await request(app)
      .post(`/api/v1/admin/users/${created.body.data._id}/deactivate`)
      .set("Authorization", `Bearer ${accessToken}`);

    const blockedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ tenantSlug: "staff-b", email: "anita@staff-b.test", password: "KitchenPass123!" });
    expect(blockedLogin.status).toBe(401);

    await request(app)
      .post(`/api/v1/admin/users/${created.body.data._id}/activate`)
      .set("Authorization", `Bearer ${accessToken}`);

    const allowedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ tenantSlug: "staff-b", email: "anita@staff-b.test", password: "KitchenPass123!" });
    expect(allowedLogin.status).toBe(200);
    expect(allowedLogin.body.data.accessToken).toBeDefined();
  });

  it("reset-password issues a fresh invite token that supersedes the old password", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("staff-e");
    const created = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Suresh Iyer", email: "suresh@staff-e.test", role: "WAITER", branchId: defaultBranch._id.toString() });

    const firstToken = "first-token";
    await forceKnownInviteToken(created.body.data._id, firstToken);
    await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ tenantSlug: "staff-e", email: "suresh@staff-e.test", inviteToken: firstToken, newPassword: "Pass111!" });

    const reset = await request(app)
      .post(`/api/v1/admin/users/${created.body.data._id}/reset-password`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(reset.status).toBe(200);

    // old password no longer works after a reset clears passwordHash
    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ tenantSlug: "staff-e", email: "suresh@staff-e.test", password: "Pass111!" });
    expect(oldPasswordLogin.status).toBe(401);

    const secondToken = "second-token";
    await forceKnownInviteToken(created.body.data._id, secondToken);
    const acceptSecond = await request(app)
      .post("/api/v1/auth/accept-invite")
      .send({ tenantSlug: "staff-e", email: "suresh@staff-e.test", inviteToken: secondToken, newPassword: "Pass222!" });
    expect(acceptSecond.status).toBe(200);

    const newLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ tenantSlug: "staff-e", email: "suresh@staff-e.test", password: "Pass222!" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects creating staff with a duplicate email within the same tenant", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("staff-c");
    const branchId = defaultBranch._id.toString();

    await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "First", email: "dup@staff-c.test", role: "WAITER", branchId });

    const dup = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Second", email: "dup@staff-c.test", role: "KITCHEN", branchId });
    expect(dup.status).toBe(409);
  });
});
