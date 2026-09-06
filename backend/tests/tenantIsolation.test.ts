import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Tenant } from "../src/models/Tenant.js";
import { Branch } from "../src/models/Branch.js";
import { User } from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

async function createTenantWithWaiter(slug: string, password: string) {
  const tenant = await Tenant.create({ name: slug, slug, status: "ACTIVE" });
  const branch = await Branch.create({
    tenantId: tenant._id,
    name: "Main",
    slug: "main",
    isDefault: true,
    status: "ACTIVE",
  });
  const passwordHash = await hashPassword(password);
  const user = await User.create({
    tenantId: tenant._id,
    branchId: branch._id,
    name: "Staff",
    email: "staff@cafe.com", // same email reused across tenants deliberately (§32)
    passwordHash,
    role: "WAITER",
    active: true,
  });
  return { tenant, branch, user };
}

describe("tenant isolation", () => {
  it("the same email in two different tenants never cross-authenticates", async () => {
    const app = createApp();
    const a = await createTenantWithWaiter("cafe-a", "PasswordA1!");
    const b = await createTenantWithWaiter("cafe-b", "PasswordB1!");

    const wrongTenant = await request(app).post("/api/v1/auth/login").send({
      tenantSlug: b.tenant.slug,
      email: "staff@cafe.com",
      password: "PasswordA1!", // tenant A's password, tenant B's slug
    });
    expect(wrongTenant.status).toBe(401);

    const correct = await request(app).post("/api/v1/auth/login").send({
      tenantSlug: a.tenant.slug,
      email: "staff@cafe.com",
      password: "PasswordA1!",
    });
    expect(correct.status).toBe(200);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${correct.body.data.accessToken}`);
    expect(me.body.data.tenantId.toString()).toBe(a.tenant._id.toString());
    expect(me.body.data.tenantId.toString()).not.toBe(b.tenant._id.toString());
  });

  it("tenant/branch context always comes from the token, never a client-supplied header", async () => {
    const app = createApp();
    const a = await createTenantWithWaiter("cafe-c", "PasswordC1!");

    const login = await request(app).post("/api/v1/auth/login").send({
      tenantSlug: a.tenant.slug,
      email: "staff@cafe.com",
      password: "PasswordC1!",
    });

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`)
      .set("X-Tenant-Id", "000000000000000000000000")
      .set("X-Branch-Id", "000000000000000000000000");

    expect(me.status).toBe(200);
    expect(me.body.data.tenantId.toString()).toBe(a.tenant._id.toString());
    expect(me.body.data.branchId.toString()).toBe(a.branch._id.toString());
  });

  it("a suspended tenant's staff cannot log in", async () => {
    const app = createApp();
    const a = await createTenantWithWaiter("cafe-d", "PasswordD1!");
    await Tenant.updateOne({ _id: a.tenant._id }, { status: "SUSPENDED" });

    const login = await request(app).post("/api/v1/auth/login").send({
      tenantSlug: a.tenant.slug,
      email: "staff@cafe.com",
      password: "PasswordD1!",
    });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe("TENANT_UNAVAILABLE");
  });
});
