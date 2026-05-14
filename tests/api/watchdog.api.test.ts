// API tests for Watchdog operations routes and safety controls.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createAndLoginStaffUser, loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
let staffToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;

  const staff = await createAndLoginStaffUser(app, adminToken);
  staffToken = staff.token;
});

describe("watchdog api", () => {
  it("loads ops overview for admin", async () => {
    const res = await request(app)
      .get("/api/watchdog/ops/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("overview");
    expect(res.body).toHaveProperty("attentionItems");
  });

  it("blocks staff users from watchdog ops routes", async () => {
    const res = await request(app)
      .get("/api/watchdog/ops/overview")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it("blocks restore execute when execute flag is not true", async () => {
    const res = await request(app)
      .post("/api/watchdog/ops/restore/execute")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        backupId: "not-used",
        dryRunId: "not-used",
        confirmationText: "not-used",
        reason: "api test",
        execute: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("WATCHDOG_RESTORE_EXECUTE_CONFIRM");
  });

  it("returns health payload shape", async () => {
    const res = await request(app)
      .get("/api/watchdog/ops/health")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.checks)).toBe(true);
    expect(res.body.summary).toHaveProperty("healthy");
    expect(res.body.summary).toHaveProperty("broken");
  });
});
