import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { Branch } from "../src/models/Branch.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { hashPassword } from "../src/utils/password.js";
import { encrypt, decrypt } from "../src/utils/encryption.js";
import { tenantService } from "../src/services/tenant.service.js";

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

  const app = createApp();
  await request(app)
    .post("/api/v1/auth/accept-invite")
    .send({ tenantSlug: slug, email: admin.email, inviteToken, newPassword: "AdminPass123!" });
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ tenantSlug: slug, email: admin.email, password: "AdminPass123!" });

  return { app, tenant, defaultBranch: branch, accessToken: login.body.data.accessToken as string };
}

describe("encryption round trip", () => {
  it("decrypts what it encrypted, and rejects tampered ciphertext", () => {
    const secret = "rzp_test_secret_abc123";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decrypt(ciphertext)).toBe(secret);

    const tampered = ciphertext.slice(0, -2) + "zz";
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe("tenant payment settings", () => {
  it("saves tenant-wide default settings without ever echoing the secret back", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("pay-a");

    const save = await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        provider: "RAZORPAY",
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        currency: "INR",
        enabled: true,
        testMode: true,
      });
    expect(save.status).toBe(200);
    expect(save.body.data.hasKeySecret).toBe(true);
    expect(save.body.data.keyId).toBe("rzp_test_key");
    expect(JSON.stringify(save.body)).not.toContain("rzp_test_secret");

    const get = await request(app)
      .get("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data.isOverride).toBe(true);
    expect(get.body.data.provider).toBe("RAZORPAY");

    const actions = (await AuditLog.find({ tenantId: tenant._id })).filter(
      (a) => a.action === "PAYMENT_SETTINGS_UPDATED" || a.action === "PAYMENT_PROVIDER_CHANGED",
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const entry of actions) {
      expect(entry.before).toBeUndefined();
      expect(entry.after).toBeUndefined();
    }
  });

  it("resolves branch-specific settings over the tenant-wide default, and can fall back again (§6A.3)", async () => {
    const { app, defaultBranch, accessToken } = await createActivatedTenantAdmin("pay-b");

    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "tenant-wide-key", keySecret: "s1", enabled: true });

    const branchId = defaultBranch._id.toString();
    await request(app)
      .put(`/api/v1/tenant/payment-settings?branchId=${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "branch-key", keySecret: "s2", enabled: true });

    const resolved = await request(app)
      .get(`/api/v1/tenant/payment-settings?branchId=${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(resolved.body.data.keyId).toBe("branch-key");
    expect(resolved.body.data.isOverride).toBe(true);

    const cleared = await request(app)
      .delete(`/api/v1/tenant/payment-settings?branchId=${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(cleared.status).toBe(200);

    const fallenBack = await request(app)
      .get(`/api/v1/tenant/payment-settings?branchId=${branchId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(fallenBack.body.data.keyId).toBe("tenant-wide-key");
    expect(fallenBack.body.data.isOverride).toBe(false);
  });

  it("copy pre-fills non-secret fields only, and never leaks the secret itself", async () => {
    const { app, tenant, accessToken } = await createActivatedTenantAdmin("pay-c");

    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "source-key", keySecret: "super-secret", testMode: true });

    const secondBranch = await Branch.create({
      tenantId: tenant._id,
      name: "Second",
      slug: "second",
      status: "ACTIVE",
    });

    const copy = await request(app)
      .post("/api/v1/tenant/payment-settings/copy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ toBranchId: secondBranch._id.toString() });

    expect(copy.status).toBe(200);
    expect(copy.body.data.keyId).toBe("source-key");
    expect(copy.body.data.testMode).toBe(true);
    expect(JSON.stringify(copy.body)).not.toContain("super-secret");
    expect(copy.body.data.keySecret).toBeUndefined();
  });

  it("test-connection reports failure gracefully for invalid/fake credentials instead of throwing", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-d");

    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "rzp_test_fake", keySecret: "fake_secret", enabled: true });

    const result = await request(app)
      .post("/api/v1/tenant/payment-settings/test")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(result.status).toBe(200);
    expect(result.body.data.ok).toBe(false);
    expect(typeof result.body.data.message).toBe("string");
  }, 20000);

  it("tests credentials typed into the form directly, without requiring a save first", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-f");

    // Deliberately never saved — this is the bug: "Test Connection" used to only ever check
    // what was already persisted, so a café admin testing brand-new credentials before
    // saving them always got "No payment credentials are configured yet." regardless of
    // what they'd actually typed into the form.
    const result = await request(app)
      .post("/api/v1/tenant/payment-settings/test")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "rzp_test_unsaved", keySecret: "unsaved_secret" });

    expect(result.status).toBe(200);
    expect(result.body.data.message).not.toBe("No payment credentials are configured yet.");
    // A real (rejected, since these are fake) gateway attempt, not the old placeholder.
    expect(result.body.data.ok).toBe(false);

    const saved = await request(app)
      .get("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(saved.body.data).toBeNull(); // confirms nothing was persisted by testing alone
  }, 20000);

  it("test-connection asks for credentials when neither typed nor saved", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-g");

    const result = await request(app)
      .post("/api/v1/tenant/payment-settings/test")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ ok: false, message: "Enter a Key ID and Key Secret to test the connection." });
  });

  it("falls back to the already-saved Key Secret when testing a new Key ID with the secret left blank", async () => {
    const { app, accessToken } = await createActivatedTenantAdmin("pay-h");

    await request(app)
      .put("/api/v1/tenant/payment-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "rzp_test_original", keySecret: "original_secret", enabled: true });

    // New Key ID, no Key Secret in the request — should reuse the saved (decrypted) secret
    // rather than treating the test as "no credentials", same "leave blank to keep"
    // convention Save itself uses.
    const result = await request(app)
      .post("/api/v1/tenant/payment-settings/test")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ provider: "RAZORPAY", keyId: "rzp_test_changed" });

    expect(result.status).toBe(200);
    expect(result.body.data.message).not.toBe("Enter a Key ID and Key Secret to test the connection.");
    expect(result.body.data.ok).toBe(false); // fake credentials, genuinely rejected by the gateway
  }, 20000);

  it("requires authentication", async () => {
    const { app } = await createActivatedTenantAdmin("pay-e");
    const res = await request(app).get("/api/v1/tenant/payment-settings");
    expect(res.status).toBe(401);
  });
});
