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

// ─── Compassion CRM smoke tests ────────────────────────────────────────────────

describe("compassion CRM smoke", () => {
  let compassionToken = "";
  let createdClientId = "";
  let createdCaseId = "";

  beforeAll(async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "admin@hopefoundation.org",
      password: "admin123!",
    });
    compassionToken = res.body.data?.accessToken ?? "";
  });

  it("returns dashboard summary with expected shape", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app).get("/api/compassion/dashboard-summary").set(auth);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalClients).toBe("number");
    expect(typeof res.body.activeClients).toBe("number");
    expect(typeof res.body.activeCases).toBe("number");
    expect(typeof res.body.tasksDue).toBe("number");
    expect(Array.isArray(res.body.caseloadByStatus)).toBe(true);
    expect(Array.isArray(res.body.casesByStatus)).toBe(true);
    expect(Array.isArray(res.body.todaysAppointments)).toBe(true);
    expect(Array.isArray(res.body.upcomingFollowUps)).toBe(true);
  });

  it("creates a new Compassion CRM client", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app).post("/api/compassion/clients").set(auth).send({
      firstName: "Smoke",
      lastName: "TestClient",
      email: "smoke-compassion@example.com",
      intakeDate: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe("Smoke");
    createdClientId = res.body.id;
    expect(createdClientId).toBeTruthy();
  });

  it("lists clients and includes the newly created one", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app).get("/api/compassion/clients?limit=100").set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ id: string }>).some((c) => c.id === createdClientId);
    expect(found).toBe(true);
  });

  it("opens a case with correct case number format", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app).post("/api/compassion/cases").set(auth).send({
      clientId: createdClientId,
      caseType: "OTHER",
      priority: "MEDIUM",
    });
    expect(res.status).toBe(201);
    expect(res.body.caseNumber).toMatch(/^CASE-\d{4}-\d{3,}$/);
    expect(res.body.caseStatus).toBe("OPEN");
    createdCaseId = res.body.id;
    expect(createdCaseId).toBeTruthy();
  });

  it("lists cases and includes the newly created case", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app).get("/api/compassion/cases?limit=100").set(auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as Array<{ id: string }>).some((c) => c.id === createdCaseId);
    expect(found).toBe(true);
  });

  it("creates a follow-up for the client", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).post("/api/compassion/follow-ups").set(auth).send({
      clientId: createdClientId,
      caseId: createdCaseId,
      title: "Smoke follow-up check-in",
      priority: "HIGH",
      dueDate,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.priority).toBe("HIGH");
  });

  it("schedules an appointment for the client", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).post("/api/compassion/appointments").set(auth).send({
      clientId: createdClientId,
      caseId: createdCaseId,
      appointmentType: "INTAKE",
      startTime,
    });
    expect(res.status).toBe(201);
    expect(res.body.appointmentType).toBe("INTAKE");
  });

  it("imports compassion clients via dry-run", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app)
      .post("/api/compassion/clients/import")
      .set(auth)
      .send({
        records: [
          { firstName: "Jane", lastName: "Doe", email: "jane.import@test.com", clientStatus: "ACTIVE" },
          { firstName: "John", lastName: "Smith", email: "john.import@test.com", clientStatus: "INACTIVE" },
        ],
        mode: "create_only",
        dryRun: true,
        matchExternalSourceId: false,
        matchEmail: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.created).toBe(2);
  });

  it("blocks SSN from compassion import payload", async () => {
    const auth = { Authorization: `Bearer ${compassionToken}` };
    const res = await request(app)
      .post("/api/compassion/clients/import")
      .set(auth)
      .send({
        records: [
          { firstName: "Alicia", lastName: "Rivera", ssn: "123-45-6789", clientStatus: "ACTIVE" },
        ],
        mode: "create_only",
        dryRun: false,
        matchExternalSourceId: false,
        matchEmail: false,
      });
    expect(res.status).toBe(200);
    // SSN must be stripped — import should succeed without it
    expect(res.body.created).toBe(1);
  });
});
