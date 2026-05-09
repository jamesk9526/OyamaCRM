import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];

beforeAll(async () => {
  // NODE_ENV is set to "test" automatically by Vitest
  const mod = await import("@/server/src/index");
  app = mod.default;
});

describe("API smoke tests", () => {
  it("responds on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("db");
  });

  it("returns settings payload", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orgName");
    expect(res.body).toHaveProperty("smtpHost");
  });

  it("returns events list endpoint", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
