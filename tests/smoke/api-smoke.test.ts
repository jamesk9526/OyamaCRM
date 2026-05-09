import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let authToken = "";

beforeAll(async () => {
  // NODE_ENV is set to "test" automatically by Vitest
  const mod = await import("@/server/src/index");
  app = mod.default;

  // Authenticate once so protected-route tests can use the token
  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  authToken = login.body.data?.accessToken ?? "";
});

describe("API smoke tests", () => {
  it("responds on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    // The health endpoint returns "database" (not "db") with the DB connection status
    expect(res.body).toHaveProperty("database");
  });

  it("returns settings payload (requires auth)", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orgName");
    expect(res.body).toHaveProperty("smtpHost");
  });

  it("returns events list endpoint (requires auth)", async () => {
    const res = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns event reports summary endpoint (requires auth)", async () => {
    const res = await request(app)
      .get("/api/events/reports/summary")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalEvents");
    expect(res.body).toHaveProperty("totalRevenue");
    expect(res.body).toHaveProperty("totalAttendees");
    expect(res.body).toHaveProperty("topEvents");
    expect(Array.isArray(res.body.topEvents)).toBe(true);
  });
});
