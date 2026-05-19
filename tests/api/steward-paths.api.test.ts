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

  it("allows saving new steps after prior steps were archived", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/steward-paths/templates")
      .set(auth)
      .send({
        name: `API Steward Path ReSave ${Date.now()}`,
        targetType: "CONSTITUENT",
        crmScope: "DONOR",
        status: "DRAFT",
        triggerType: "MANUAL",
      });
    expect(created.status).toBe(201);
    const pathId = created.body.id as string;

    const firstStep = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({
        name: "Initial step",
        stepType: "CREATE_TASK",
      });
    expect(firstStep.status).toBe(201);
    const firstStepId = firstStep.body.id as string;

    const archived = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}/steps/${firstStepId}`)
      .set(auth);
    expect(archived.status).toBe(204);

    const secondStep = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({
        name: "Resaved step",
        stepType: "CREATE_TASK",
        orderIndex: 0,
      });
    expect(secondStep.status).toBe(201);

    const cleanup = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}`)
      .set(auth);
    expect(cleanup.status).toBe(204);
  });

  it("reorders steps without unique order collisions", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const created = await request(app)
      .post("/api/steward-paths/templates")
      .set(auth)
      .send({
        name: `API Steward Path Reorder ${Date.now()}`,
        targetType: "CONSTITUENT",
        crmScope: "DONOR",
        status: "DRAFT",
        triggerType: "MANUAL",
      });
    expect(created.status).toBe(201);
    const pathId = created.body.id as string;

    const stepA = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({ name: "Step A", stepType: "CREATE_TASK", orderIndex: 0 });
    expect(stepA.status).toBe(201);

    const stepB = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({ name: "Step B", stepType: "CREATE_TASK", orderIndex: 1 });
    expect(stepB.status).toBe(201);

    const stepC = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({ name: "Step C", stepType: "CREATE_TASK", orderIndex: 2 });
    expect(stepC.status).toBe(201);

    const reordered = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps/reorder`)
      .set(auth)
      .send({ stepIds: [stepC.body.id, stepA.body.id, stepB.body.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.steps.map((step: { id: string }) => step.id)).toEqual([
      stepC.body.id,
      stepA.body.id,
      stepB.body.id,
    ]);

    const cleanup = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}`)
      .set(auth);
    expect(cleanup.status).toBe(204);
  });
});
