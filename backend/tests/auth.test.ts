import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PlatformAdmin } from "../src/models/PlatformAdmin.js";
import { hashPassword } from "../src/utils/password.js";

async function seedPlatformAdmin(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return PlatformAdmin.create({ name: "Root", email, passwordHash });
}

describe("refresh token rotation", () => {
  it("rotates on use and rejects reuse of an already-rotated token", async () => {
    const app = createApp();
    await seedPlatformAdmin("root@yummverse.test", "PlatformPass123!");

    const login = await request(app)
      .post("/api/v1/platform/auth/login")
      .send({ email: "root@yummverse.test", password: "PlatformPass123!" });
    expect(login.status).toBe(200);
    const firstRefresh = login.body.data.refreshToken;

    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(firstRefresh);

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: firstRefresh });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe("REFRESH_TOKEN_REUSED");

    // Reuse detection revokes the whole chain, including the token issued by the rotation above.
    const chainRevoked = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.data.refreshToken });
    expect(chainRevoked.status).toBe(401);
  });

  it("rejects a refresh token after logout", async () => {
    const app = createApp();
    await seedPlatformAdmin("root3@yummverse.test", "PlatformPass123!");

    const login = await request(app)
      .post("/api/v1/platform/auth/login")
      .send({ email: "root3@yummverse.test", password: "PlatformPass123!" });
    const { refreshToken } = login.body.data;

    const logout = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it("rejects invalid credentials without leaking whether the account exists", async () => {
    const app = createApp();
    await seedPlatformAdmin("root4@yummverse.test", "PlatformPass123!");

    const wrongPassword = await request(app)
      .post("/api/v1/platform/auth/login")
      .send({ email: "root4@yummverse.test", password: "WrongPassword!" });
    const noSuchUser = await request(app)
      .post("/api/v1/platform/auth/login")
      .send({ email: "nobody@yummverse.test", password: "WrongPassword!" });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe(noSuchUser.body.error.code);
  });
});
