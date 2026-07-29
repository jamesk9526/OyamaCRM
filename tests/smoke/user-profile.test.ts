import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let authToken = "";

beforeAll(async () => {
  app = (await import("@/server/src/index")).default;
  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  expect(login.status).toBe(200);
  authToken = login.body.data.accessToken;
});

describe("personal profile settings", () => {
  it("returns only the current user's profile and usage history", async () => {
    const response = await request(app)
      .get("/api/users/me/profile")
      .set("Authorization", `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.profile.email).toBe("admin@hopefoundation.org");
    expect(response.body.profile).not.toHaveProperty("passwordHash");
    expect(response.body.usage.actionCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(response.body.usage.recentActivity)).toBe(true);
  });

  it("updates personal fields without accepting role or email changes", async () => {
    const current = await request(app)
      .get("/api/users/me/profile")
      .set("Authorization", `Bearer ${authToken}`);
    const profile = current.body.profile;

    const response = await request(app)
      .put("/api/users/me/profile")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        firstName: profile.firstName,
        lastName: profile.lastName,
        preferredName: profile.preferredName,
        phone: profile.phone,
        jobTitle: profile.jobTitle,
        timezone: profile.timezone ?? "America/Chicago",
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        email: "not-allowed@example.com",
        role: "readonly",
      });

    expect(response.status).toBe(200);
    expect(response.body.profile.email).toBe("admin@hopefoundation.org");
    expect(response.body.profile.role).toBe(profile.role);
  });
});
