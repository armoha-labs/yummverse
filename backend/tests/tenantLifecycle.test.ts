import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Branch } from "../src/models/Branch.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { hashPassword } from "../src/utils/password.js";
import { tenantService } from "../src/services/tenant.service.js";

describe("tenant lifecycle", () => {
  it("platform admin creates a tenant with a default branch; invited admin sets a password and logs in", async () => {
    const app = createApp();

    const passwordHash = await hashPassword("PlatformPass123!");
    const platformAdmin = await PlatformAdmin.create({
      name: "Root",
      email: "root@yummverse.test",
      passwordHash,
    });

    const { tenant, branch, admin, inviteToken } = await tenantService.createTenant(
      {
        name: "Green Leaf Café",
        slug: "green-leaf",
        adminName: "Asha",
        adminEmail: "asha@greenleaf.test",
      },
      { platformAdminId: platformAdmin._id.toString() },
    );

    expect(branch.isDefault).toBe(true);
    expect(await Branch.countDocuments({ tenantId: tenant._id })).toBe(1);

    const actions = (await AuditLog.find({ tenantId: tenant._id })).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["TENANT_CREATED", "USER_CREATED"]));

    const acceptRes = await request(app).post("/api/v1/auth/accept-invite").send({
      tenantSlug: tenant.slug,
      email: admin.email,
      inviteToken,
      newPassword: "AdminPass123!",
    });
    expect(acceptRes.status).toBe(200);

    const loginRes = await request(app).post("/api/v1/auth/login").send({
      tenantSlug: tenant.slug,
      email: admin.email,
      password: "AdminPass123!",
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe("TENANT_ADMIN");
    expect(meRes.body.data.tenantId.toString()).toBe(tenant._id.toString());
  });

  it("platform admin can suspend and reactivate a tenant, each transition audited", async () => {
    const app = createApp();
    const passwordHash = await hashPassword("PlatformPass123!");
    await PlatformAdmin.create({ name: "Root", email: "root2@yummverse.test", passwordHash });

    const login = await request(app)
      .post("/api/v1/platform/auth/login")
      .send({ email: "root2@yummverse.test", password: "PlatformPass123!" });
    const token = login.body.data.accessToken;

    const create = await request(app)
      .post("/api/v1/platform/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Blue Bean", slug: "blue-bean", adminName: "Rao", adminEmail: "rao@bluebean.test" });
    expect(create.status).toBe(201);
    const tenantId = create.body.data.tenant._id ?? create.body.data.tenant.id;

    const suspend = await request(app)
      .post(`/api/v1/platform/tenants/${tenantId}/suspend`)
      .set("Authorization", `Bearer ${token}`);
    expect(suspend.status).toBe(200);
    expect(suspend.body.data.status).toBe("SUSPENDED");

    const activate = await request(app)
      .post(`/api/v1/platform/tenants/${tenantId}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(activate.status).toBe(200);
    expect(activate.body.data.status).toBe("ACTIVE");

    const actions = (await AuditLog.find({ tenantId })).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["TENANT_SUSPENDED", "TENANT_ACTIVATED"]));
  });
});
