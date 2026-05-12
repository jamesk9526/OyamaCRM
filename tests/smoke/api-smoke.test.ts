import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let authToken = "";

beforeAll(async () => {
  // NODE_ENV is set to "test" automatically by Vitest
  const mod = await import("@/server/src/index");
  app = mod.default;

  // Authenticate once so protected-route tests can use the token
  const login = await request(app).post("/api/auth/login").send({
    email: "admin@hopefoundation.org",
    password: "admin123!",
  });
  authToken = login.body.data?.accessToken ?? "";
});

describe("API smoke tests", () => {
  it("responds on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    // The health endpoint returns "database" (not "db") with the DB connection status
    expect(res.body).toHaveProperty("database");
    expect(res.body).toHaveProperty("queue");
    expect(typeof res.body.queue.running).toBe("boolean");
  });

  it("returns settings payload (requires auth)", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("orgName");
    expect(res.body).toHaveProperty("smtpHost");
  });

  it("validates smtp test recipient email", async () => {
    const res = await request(app)
      .post("/api/settings/smtp/test")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ toEmail: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe("INVALID_EMAIL");
  });

  it("returns events list endpoint (requires auth)", async () => {
    const res = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns event reports summary endpoint (requires auth)", async () => {
    const res = await request(app)
      .get("/api/events/reports/summary")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalEvents");
    expect(res.body).toHaveProperty("totalRevenue");
    expect(res.body).toHaveProperty("totalAttendees");
    expect(res.body).toHaveProperty("topEvents");
    expect(Array.isArray(res.body.topEvents)).toBe(true);
  });

  it("creates and processes a steward path sequence", async () => {
    const auth = { Authorization: `Bearer ${authToken}` };
    const uniqueName = `Smoke Sequence ${Date.now()}`;

    const created = await request(app)
      .post("/api/steward-paths/templates")
      .set(auth)
      .send({
        name: uniqueName,
        targetType: "CONSTITUENT",
        crmScope: "DONOR",
        status: "ACTIVE",
      });
    expect(created.status).toBe(201);
    const pathId = created.body.id as string;
    expect(pathId).toBeTruthy();

    const step = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({
        name: "Add internal note",
        stepType: "INTERNAL_NOTE",
        configJson: { noteTemplate: "Smoke note for {{firstName}}" },
      });
    expect(step.status).toBe(201);

    const enrollment = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/enrollments`)
      .set(auth)
      .send({
        targetId: "con_01",
        targetType: "CONSTITUENT",
        constituentId: "con_01",
      });
    expect(enrollment.status).toBe(201);
    const enrollmentId = enrollment.body.id as string;
    expect(enrollmentId).toBeTruthy();

    const processed = await request(app)
      .post("/api/steward-paths/process-due")
      .set(auth)
      .send({ limit: 25 });
    expect(processed.status).toBe(200);
    expect(processed.body).toHaveProperty("processed");

    const listed = await request(app)
      .get(`/api/steward-paths/enrollments?pathId=${encodeURIComponent(pathId)}`)
      .set(auth);
    expect(listed.status).toBe(200);
    const found = (listed.body as Array<{ id: string; status: string }>).find((item) => item.id === enrollmentId);
    expect(found).toBeTruthy();

    const archived = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}`)
      .set(auth);
    expect(archived.status).toBe(204);
  });

  it("processes GENERATE_LETTER step and creates linked task", async () => {
    const auth = { Authorization: `Bearer ${authToken}` };

    const constituents = await request(app)
      .get("/api/constituents")
      .set(auth);
    expect(constituents.status).toBe(200);
    const constituent = (constituents.body as Array<{ id: string }>)[0];
    expect(constituent?.id).toBeTruthy();

    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth)
      .send({
        name: `Smoke Sequence Letter ${Date.now()}`,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "Dear {{donor.firstName}}, thank you for supporting {{organization.name}}.",
        emailBody: "Thanks {{donor.firstName}}.",
      });
    expect(template.status).toBe(201);
    const templateId = template.body.id as string;
    expect(templateId).toBeTruthy();

    const createdPath = await request(app)
      .post("/api/steward-paths/templates")
      .set(auth)
      .send({
        name: `Smoke Generate Letter Path ${Date.now()}`,
        targetType: "CONSTITUENT",
        crmScope: "DONOR",
        status: "ACTIVE",
      });
    expect(createdPath.status).toBe(201);
    const pathId = createdPath.body.id as string;
    expect(pathId).toBeTruthy();

    const createdStep = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/steps`)
      .set(auth)
      .send({
        name: "Generate thank-you letter",
        stepType: "GENERATE_LETTER",
        configJson: {
          templateId,
          taskMode: "create_and_continue",
          taskTitleTemplate: "Mail generated letter to {{firstName}} {{lastName}}",
          taskType: "MAIL",
        },
      });
    expect(createdStep.status).toBe(201);

    const enrollment = await request(app)
      .post(`/api/steward-paths/templates/${pathId}/enrollments`)
      .set(auth)
      .send({
        targetId: constituent.id,
        targetType: "CONSTITUENT",
        constituentId: constituent.id,
      });
    expect(enrollment.status).toBe(201);
    const enrollmentId = enrollment.body.id as string;
    expect(enrollmentId).toBeTruthy();

    const processed = await request(app)
      .post("/api/steward-paths/process-due")
      .set(auth)
      .send({ limit: 25 });
    expect(processed.status).toBe(200);

    const generated = await request(app)
      .get(`/api/letters/generated?stewardPathEnrollmentId=${encodeURIComponent(enrollmentId)}`)
      .set(auth);
    expect(generated.status).toBe(200);
    expect(Array.isArray(generated.body)).toBe(true);
    const letter = (generated.body as Array<{
      id: string;
      sourceTaskId?: string | null;
      stewardPathEnrollmentId?: string | null;
      stewardPathStepRunId?: string | null;
    }>).find((row) => row.stewardPathEnrollmentId === enrollmentId);
    expect(letter).toBeTruthy();
    expect(letter?.sourceTaskId).toBeTruthy();
    expect(letter?.stewardPathStepRunId).toBeTruthy();

    const tasks = await request(app)
      .get(`/api/tasks?scope=all&constituentId=${encodeURIComponent(constituent.id)}`)
      .set(auth);
    expect(tasks.status).toBe(200);
    expect(Array.isArray(tasks.body?.items)).toBe(true);
    const linkedTask = (tasks.body.items as Array<{
      id: string;
      generatedLetterId?: string | null;
      stewardPathEnrollmentId?: string | null;
    }>).find((row) => row.generatedLetterId === letter?.id && row.stewardPathEnrollmentId === enrollmentId);
    expect(linkedTask).toBeTruthy();

    const archivedPath = await request(app)
      .delete(`/api/steward-paths/templates/${pathId}`)
      .set(auth);
    expect(archivedPath.status).toBe(204);

    const archivedTemplate = await request(app)
      .delete(`/api/letters/templates/${templateId}`)
      .set(auth);
    expect(archivedTemplate.status).toBe(204);
  });

  it("creates, previews, generates, and drafts a letter", async () => {
    const auth = { Authorization: `Bearer ${authToken}` };

    const constituents = await request(app)
      .get("/api/constituents")
      .set(auth);
    expect(constituents.status).toBe(200);
    const constituent = (constituents.body as Array<{ id: string; email?: string }>).find((row) => Boolean(row.email));
    expect(constituent?.id).toBeTruthy();

    const templateName = `Smoke Letter ${Date.now()}`;
    const template = await request(app)
      .post("/api/letters/templates")
      .set(auth)
      .send({
        name: templateName,
        category: "THANK_YOU",
        status: "ACTIVE",
        printBody: "{{donor.salutation}}\nThank you for your support of {{organization.name}}.",
        emailBody: "Thank you {{donor.firstName}} for your gift.",
      });

    expect(template.status).toBe(201);
    const templateId = template.body.id as string;
    expect(templateId).toBeTruthy();

    const preview = await request(app)
      .post("/api/letters/generated/preview")
      .set(auth)
      .send({
        templateId,
        constituentId: constituent?.id,
      });
    expect(preview.status).toBe(200);
    expect(preview.body).toHaveProperty("mergedPrintBody");

    const generated = await request(app)
      .post("/api/letters/generated")
      .set(auth)
      .send({
        templateId,
        constituentId: constituent?.id,
      });
    expect(generated.status).toBe(201);
    const generatedId = generated.body.id as string;
    expect(generatedId).toBeTruthy();

    const createDraft = await request(app)
      .post(`/api/letters/generated/${generatedId}/create-email-draft`)
      .set(auth)
      .send({});
    expect(createDraft.status).toBe(200);
    expect(createDraft.body).toHaveProperty("emailCampaign");

    const history = await request(app)
      .get(`/api/letters/constituents/${constituent?.id}/generated`)
      .set(auth);
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body)).toBe(true);
    const found = (history.body as Array<{ id: string }>).some((row) => row.id === generatedId);
    expect(found).toBe(true);

    const archived = await request(app)
      .delete(`/api/letters/templates/${templateId}`)
      .set(auth);
    expect(archived.status).toBe(204);
  });
});
