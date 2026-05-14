import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let siteId = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });

  accessToken = login.body.data?.accessToken ?? "";
});

describe("webmaster publishing readiness smoke", () => {
  it("returns at least one site", async () => {
    const res = await request(app)
      .get("/api/webmaster/sites")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.items)).toBe(true);
    siteId = String(res.body?.items?.[0]?.id ?? "");
    expect(siteId).toBeTruthy();
  });

  it("returns publish-readiness payload", async () => {
    const res = await request(app)
      .get(`/api/webmaster/sites/${siteId}/publish-readiness`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body?.data?.status).toBe("string");
    expect(Array.isArray(res.body?.data?.checks)).toBe(true);
    expect(typeof res.body?.data?.preflightPassed).toBe("boolean");
  });
});
