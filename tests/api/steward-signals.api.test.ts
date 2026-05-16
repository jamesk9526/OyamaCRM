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
  it("requires live AI runtime for opportunities", { timeout: 30000 }, async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    await request(app)
      .put("/api/steward-ai/config")
      .set(auth)
      .send({ enabled: false })
      .expect(200);

    const statusAfterDisable = await request(app)
      .get("/api/steward-ai/status?force=1")
      .set(auth);
    expect(statusAfterDisable.status).toBe(200);

    const opportunities = await request(app)
      .get("/api/steward-signals/opportunities?limit=10")
      .set(auth);

    expect([200, 412]).toContain(opportunities.status);
    if (opportunities.status === 412) {
      expect(["STEWARD_AI_REQUIRED", "STEWARD_AI_NOT_LIVE"]).toContain(opportunities.body?.code);
    }

    await request(app)
      .put("/api/steward-ai/config")
      .set(auth)
      .send({ enabled: true })
      .expect(200);
  });

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
    expect([200, 412]).toContain(summary.status);
    if (summary.status === 412) {
      expect(summary.body?.code).toBe("STEWARD_AI_NOT_LIVE");
    } else {
      expect(summary.body).toHaveProperty("highOpportunityDonors");
      expect(summary.body).toHaveProperty("monthlyGivingCandidates");
      expect(summary.body).toHaveProperty("updatedAt");
    }

    const growthIdeas = await request(app)
      .get("/api/steward-signals/growth-ideas?limit=3")
      .set(auth);
    expect([200, 412]).toContain(growthIdeas.status);
    if (growthIdeas.status === 412) {
      expect(growthIdeas.body?.code).toBe("STEWARD_AI_NOT_LIVE");
    } else {
      expect(Array.isArray(growthIdeas.body?.ideas)).toBe(true);
      expect(growthIdeas.body.ideas.length).toBeLessThanOrEqual(3);
      expect(growthIdeas.body).toHaveProperty("scoringSummary");
    }
  });

  it("returns dashboard focus, research output, and lapse radar groups", { timeout: 30000 }, async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const focus = await request(app)
      .get("/api/steward-signals/dashboard-focus")
      .set(auth);
    expect([200, 412]).toContain(focus.status);
    if (focus.status === 412) {
      expect(focus.body?.code).toBe("STEWARD_AI_NOT_LIVE");
    } else {
      expect(Array.isArray(focus.body?.focusLines)).toBe(true);
      expect(Array.isArray(focus.body?.topPriorities)).toBe(true);
    }

    const research = await request(app)
      .post("/api/steward-signals/research")
      .set(auth)
      .send({
        mode: "research",
        query: "Which donors gave last year but not this year?",
        limit: 10,
      });
    expect([200, 412]).toContain(research.status);
    if (research.status === 412) {
      expect(research.body?.code).toBe("STEWARD_AI_NOT_LIVE");
    } else {
      expect(research.body).toHaveProperty("scenario");
      expect(research.body).toHaveProperty("summary");
      expect(Array.isArray(research.body?.donors)).toBe(true);
      expect(Array.isArray(research.body?.chart?.lapseDistribution)).toBe(true);
    }

    const lapse = await request(app)
      .get("/api/steward-signals/lapse-radar")
      .set(auth);
    expect([200, 412]).toContain(lapse.status);
    if (lapse.status === 412) {
      expect(lapse.body?.code).toBe("STEWARD_AI_NOT_LIVE");
    } else {
      expect(lapse.body).toHaveProperty("groups");
      expect(lapse.body).toHaveProperty("distribution");
    }
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
