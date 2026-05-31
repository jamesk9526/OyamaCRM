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
  it("supports duplicate/share/playground operations without production writes", async () => {
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

    const enrollmentsBefore = await request(app)
      .get(`/api/steward-paths/enrollments?pathId=${encodeURIComponent(pathId)}`)
      .set(auth);
    expect(enrollmentsBefore.status).toBe(200);

    const historyBefore = await request(app)
      .get(`/api/steward-paths/templates/${pathId}/history`)
      .set(auth);
    expect(historyBefore.status).toBe(200);
    expect(Array.isArray(historyBefore.body.items)).toBe(true);
    const historyBeforeCount = (historyBefore.body.items as Array<unknown>).length;

    const scenarios = await request(app)
      .get(`/api/steward-paths/${pathId}/playground/scenarios?constituentId=con_01`)
      .set(auth);
    expect(scenarios.status).toBe(200);
    expect(scenarios.body.isSandbox).toBe(true);
    expect(Array.isArray(scenarios.body.scenarios)).toBe(true);
    expect(scenarios.body.scenarios.length).toBeGreaterThan(0);

    const run = await request(app)
      .post(`/api/steward-paths/${pathId}/playground/run`)
      .set(auth)
      .send({
        constituentId: "con_01",
        scenarioId: scenarios.body.scenarios[0]?.id,
        options: {
          skipDelays: true,
          testEmail: "qa@example.org",
        },
      });
    expect(run.status).toBe(201);
    expect(run.body.isSandbox).toBe(true);
    expect(typeof run.body.runId).toBe("string");

    const stepped = await request(app)
      .post(`/api/steward-paths/${pathId}/playground/step`)
      .set(auth)
      .send({ runId: run.body.runId, action: "auto" });
    expect(stepped.status).toBe(200);
    expect(stepped.body.status).toBe("completed");

    const runSnapshot = await request(app)
      .get(`/api/steward-paths/${pathId}/playground/runs/${encodeURIComponent(run.body.runId as string)}`)
      .set(auth);
    expect(runSnapshot.status).toBe(200);
    expect(runSnapshot.body.runId).toBe(run.body.runId);

    const runActivity = await request(app)
      .get(`/api/steward-paths/${pathId}/playground/runs/${encodeURIComponent(run.body.runId as string)}/activity`)
      .set(auth);
    expect(runActivity.status).toBe(200);
    expect(runActivity.body.isSandbox).toBe(true);
    expect(Array.isArray(runActivity.body.items)).toBe(true);

    const sandboxEmails = await request(app)
      .post(`/api/steward-paths/${pathId}/playground/send-test-email`)
      .set(auth)
      .send({ runId: run.body.runId, testEmail: "qa@example.org" });
    expect(sandboxEmails.status).toBe(200);
    expect(sandboxEmails.body.isSandbox).toBe(true);
    expect(sandboxEmails.body.analyticsTracked).toBe(false);

    const testRun = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/test-run`)
      .set(auth)
      .send({ constituentId: "con_01" });
    expect(testRun.status).toBe(201);
    expect(testRun.body.success).toBe(true);
    expect(testRun.body.isSandbox).toBe(true);

    const enrollmentsAfter = await request(app)
      .get(`/api/steward-paths/enrollments?pathId=${encodeURIComponent(pathId)}`)
      .set(auth);
    expect(enrollmentsAfter.status).toBe(200);
    expect((enrollmentsAfter.body as Array<unknown>).length).toBe((enrollmentsBefore.body as Array<unknown>).length);

    const history = await request(app)
      .get(`/api/steward-paths/templates/${pathId}/history`)
      .set(auth);
    expect(history.status).toBe(200);
    expect(history.body.pathId).toBe(pathId);
    expect(Array.isArray(history.body.items)).toBe(true);
    expect((history.body.items as Array<unknown>).length).toBe(historyBeforeCount);

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
