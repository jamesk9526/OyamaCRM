import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let accessToken = "";
let campaignId = "";
let taskId = "";

beforeAll(async () => {
  // NODE_ENV is set to "test" automatically by Vitest
  const mod = await import("@/server/src/index");
  app = mod.default;
});

describe("route workflow smoke", () => {
  it("authenticates seeded admin user", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@hopefoundation.org",
      password: "admin123!",
    });
    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken).toBeTruthy();
    accessToken = res.body.data.accessToken;
  });

  it("reads core list endpoints", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const [constituents, campaigns, donations, tasks, reports, automations, emailStats] = await Promise.all([
      request(app).get("/api/constituents").set(auth),
      request(app).get("/api/campaigns").set(auth),
      request(app).get("/api/donations").set(auth),
      request(app).get("/api/tasks").set(auth),
      request(app).get("/api/reports/summary").set(auth),
      request(app).get("/api/automations").set(auth),
      request(app).get("/api/email-campaigns/stats").set(auth),
    ]);
    expect(constituents.status).toBe(200);
    expect(campaigns.status).toBe(200);
    expect(donations.status).toBe(200);
    expect(tasks.status).toBe(200);
    expect(reports.status).toBe(200);
    expect(automations.status).toBe(200);
    expect(emailStats.status).toBe(200);
  });

  it("creates and updates campaign/task/event entities", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const campaign = await request(app).post("/api/campaigns").set(auth).send({
      organizationId: "org_demo",
      name: "Smoke Test Campaign",
      category: "GENERAL",
      startDate: new Date().toISOString(),
      goal: 12345,
      active: true,
    });
    expect(campaign.status).toBe(201);
    campaignId = campaign.body.id;

    const task = await request(app).post("/api/tasks").set(auth).send({
      title: "Smoke follow-up task",
      type: "FOLLOW_UP",
      status: "PENDING",
      priority: "MEDIUM",
      constituentId: "con_01",
    });
    expect(task.status).toBe(201);
    taskId = task.body.id;

    const taskDone = await request(app).patch(`/api/tasks/${taskId}`).set(auth).send({ status: "COMPLETED" });
    expect(taskDone.status).toBe(200);

    const event = await request(app).post("/api/events").set(auth).send({
      name: "Smoke Event",
      type: "WORKSHOP",
      startDate: new Date().toISOString(),
      location: "HQ",
    });
    expect(event.status).toBe(201);
  });

  it("creates email campaign and automation preset install", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const emailCampaign = await request(app).post("/api/email-campaigns").set(auth).send({
      name: "Smoke Email",
      subject: "Smoke",
      fromName: "Hope Community Foundation",
      fromEmail: "giving@hopecommunity.org",
      bodyText: "hello",
      templateJson: "{\"blocks\":[]}",
    });
    expect(emailCampaign.status).toBe(201);
    expect(emailCampaign.body.id).toBeTruthy();

    const presets = await request(app).get("/api/automations/presets").set(auth);
    expect(presets.status).toBe(200);
    const presetId = presets.body[0]?.id;
    expect(presetId).toBeTruthy();

    const install = await request(app).post("/api/automations/from-preset").set(auth).send({ presetId });
    expect(install.status).toBe(201);
  });

  it("reads constituent detail timeline (phase 2 starter)", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    const res = await request(app).get("/api/constituents/con_01").set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
  });

  it("cleans up smoke-created task and campaign", async () => {
    const auth = { Authorization: `Bearer ${accessToken}` };
    if (taskId) {
      const delTask = await request(app).delete(`/api/tasks/${taskId}`).set(auth);
      expect(delTask.status).toBe(204);
    }
    if (campaignId) {
      const upd = await request(app).patch(`/api/campaigns/${campaignId}`).set(auth).send({ active: false });
      expect(upd.status).toBe(200);
    }
    expect(accessToken).toBeTruthy();
  });
});
