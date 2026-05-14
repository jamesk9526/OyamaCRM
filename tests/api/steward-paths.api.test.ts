// API tests for canonical Steward Paths template operations.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;
  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

describe("steward paths api", () => {
  it("supports duplicate/share/test-run/history operations for one template", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/steward-paths/templates")
      .set(auth)
      .send({
        name: `API Steward Path ${Date.now()}`,
        targetType: "CONSTITUENT",
        crmScope: "DONOR",
        status: "DRAFT",
        triggerType: "DONATION_RECEIVED",
      });
    expect(created.status).toBe(201);
    const pathId = created.body.id as string;

    const step = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({
        name: "Create follow-up task",
        stepType: "CREATE_TASK",
        configJson: { titleTemplate: "Call {{firstName}}", priority: "HIGH" },
      });
    expect(step.status).toBe(201);

    const share = await request(app)
      .patch(`/api/steward-paths/templates/${pathId}/share`)
      .set(auth)
      .send({ visibility: "organization", allowRun: true, allowEdit: true });
    expect(share.status).toBe(200);
    expect(share.body.triggerConfig?._sharing?.visibility).toBe("organization");

    const duplicate = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/duplicate`)
      .set(auth)
      .send({});
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.name).toContain("(Copy)");
    expect(Array.isArray(duplicate.body.steps)).toBe(true);
    expect(duplicate.body.steps.length).toBeGreaterThan(0);

    const testRun = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/test-run`)
      .set(auth)
      .send({ constituentId: "con_01" });
    expect(testRun.status).toBe(201);
    expect(testRun.body.success).toBe(true);

    const history = await request(app)
      .get(`/api/steward-paths/templates/${pathId}/history`)
      .set(auth);
    expect(history.status).toBe(200);
    expect(history.body.pathId).toBe(pathId);
    expect(Array.isArray(history.body.items)).toBe(true);

    const archived = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}`)
      .set(auth);
    expect(archived.status).toBe(204);

    const archivedCopy = await request(app)
      .delete(`/api/steward-paths/templates/${duplicate.body.id as string}`)
      .set(auth);
    expect(archivedCopy.status).toBe(204);
  });
});
