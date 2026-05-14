// API integration tests for Steward Signals read and confirm-first action endpoints.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";
const createdTaskIds: string[] = [];

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

afterAll(async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };

  for (const taskId of createdTaskIds) {
    await request(app).delete(`/api/tasks/${taskId}`).set(auth);
  }
});

describe("steward signals api", () => {
  it("returns index state and supports manual rebuild", { timeout: 30000 }, async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const state = await request(app)
      .get("/api/steward-signals/index/state")
      .set(auth);
    expect(state.status).toBe(200);
    expect(state.body?.data).toHaveProperty("state");

    const rebuild = await request(app)
      .post("/api/steward-signals/index/rebuild")
      .set(auth)
      .send({});
    expect(rebuild.status).toBe(200);
    expect(rebuild.body?.data).toHaveProperty("state");
    expect(typeof rebuild.body?.data?.state?.indexedConstituentCount).toBe("number");
  });

  it("returns summary and bounded growth ideas payloads", { timeout: 30000 }, async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const summary = await request(app)
      .get("/api/steward-signals/summary")
      .set(auth);
    expect(summary.status).toBe(200);
    expect(summary.body).toHaveProperty("highOpportunityDonors");
    expect(summary.body).toHaveProperty("monthlyGivingCandidates");
    expect(summary.body).toHaveProperty("updatedAt");

    const growthIdeas = await request(app)
      .get("/api/steward-signals/growth-ideas?limit=3")
      .set(auth);
    expect(growthIdeas.status).toBe(200);
    expect(Array.isArray(growthIdeas.body?.ideas)).toBe(true);
    expect(growthIdeas.body.ideas.length).toBeLessThanOrEqual(3);
    expect(growthIdeas.body).toHaveProperty("scoringSummary");
  });

  it("enforces explicit confirmation and allows follow-up task creation", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const saveDraftMissingConfirm = await request(app)
      .post("/api/steward-signals/email-draft/save")
      .set(auth)
      .send({
        donorName: "Test Donor",
        subject: "Follow-up",
        bodyPlainText: "Thank you",
      });
    expect(saveDraftMissingConfirm.status).toBe(400);
    expect(saveDraftMissingConfirm.body?.error?.code).toBe("CONFIRMATION_REQUIRED");

    const createTaskMissingConfirm = await request(app)
      .post("/api/steward-signals/email-draft/create-follow-up-task")
      .set(auth)
      .send({ donorId: "con_01" });
    expect(createTaskMissingConfirm.status).toBe(400);
    expect(createTaskMissingConfirm.body?.error?.code).toBe("CONFIRMATION_REQUIRED");

    const createTask = await request(app)
      .post("/api/steward-signals/email-draft/create-follow-up-task")
      .set(auth)
      .send({
        confirm: true,
        donorId: "con_01",
        title: `API Follow-up ${Date.now()}`,
      });
    expect(createTask.status).toBe(201);
    expect(createTask.body?.success).toBe(true);
    expect(createTask.body?.task?.id).toBeTruthy();

    createdTaskIds.push(String(createTask.body.task.id));
  });
});
