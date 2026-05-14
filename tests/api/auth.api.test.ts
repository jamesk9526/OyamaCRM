// API tests for auth and protected route behavior.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;
});

describe("auth api", () => {
  it("rejects invalid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@hopefoundation.org",
      password: "wrong-password",
    });

    expect([400, 401]).toContain(res.status);
  });

  it("returns an access token for valid admin credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@hopefoundation.org",
      password: "admin123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken).toBeTruthy();
  });

  it("blocks protected routes without auth", async () => {
    const [settings, users, watchdog] = await Promise.all([
      request(app).get("/api/settings"),
      request(app).get("/api/users"),
      request(app).get("/api/watchdog/ops/overview"),
    ]);

    expect(settings.status).toBe(401);
    expect(users.status).toBe(401);
    expect(watchdog.status).toBe(401);
  });
});
