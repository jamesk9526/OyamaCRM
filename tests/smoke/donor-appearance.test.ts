import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createAndLoginStaffUser, loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let staffToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;
  const admin = await loginAsAdmin(app);
  const staff = await createAndLoginStaffUser(app, admin.token);
  staffToken = staff.token;
});

describe("DonorCRM personal appearance", () => {
  it("persists an authenticated user’s own theme and density without requiring admin role", async () => {
    const initial = await request(app)
      .get("/api/settings/donor-appearance")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(initial.status).toBe(200);
    expect(["light-green", "blue", "violet", "slate"]).toContain(initial.body.theme);

    const saved = await request(app)
      .put("/api/settings/donor-appearance")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ theme: "violet", density: "compact" });
    expect(saved.status).toBe(200);
    expect(saved.body.settings).toMatchObject({ theme: "violet", density: "compact" });

    const loaded = await request(app)
      .get("/api/settings/donor-appearance")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body).toMatchObject({ theme: "violet", density: "compact" });
  });
});
