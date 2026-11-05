import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "@/server/src/lib/auth";
import { starterTemplates, type Definition } from "@/server/src/surveys/definition";
import { digest } from "@/server/src/surveys/storage";
import { publicSurveys } from "@/server/src/surveys/public";
import { surveys } from "@/server/src/surveys/routes";
import { processSurveyDeliveries } from "@/server/src/surveys/worker";

// The real Express routers, authorization, token handling, validation and queue
// run here. Prisma persistence and outbound delivery use synthetic fixtures.
const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  user: { findFirst: vi.fn() }, compassionMembership: { findUnique: vi.fn() },
  organizationSettings: { findUnique: vi.fn() }, organization: { findUnique: vi.fn() },
  survey: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  surveyRevision: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn() },
  surveyResponse: { create: vi.fn(), findUnique: vi.fn() },
  surveyInvitation: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  surveyDistribution: { findUnique: vi.fn(), create: vi.fn() },
  surveyDeliveryJob: { createMany: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findFirstOrThrow: vi.fn(), findFirst: vi.fn() },
  constituent: { findMany: vi.fn() }, compassionClient: { findMany: vi.fn() },
  auditLog: { create: vi.fn() }, compassionAudit: { create: vi.fn() },
}));
const fakeSend = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/compassion/database", () => ({ prisma: db }));
vi.mock("@/server/src/services/smtp-service", () => ({
  describeOrganizationEmailSender: async () => "Fixture sender <sender@example.invalid>",
  createOrganizationEmailSender: async () => ({ send: fakeSend }),
}));

const app = express();
app.use("/api/public/surveys", publicSurveys);
app.use("/api/compassion-public/surveys", publicSurveys);
app.use(express.json());
app.use("/api/surveys", surveys);
app.use("/api/compassion/surveys", surveys);

const token = (sub = "manager", orgId = "org-one", role = "manager") =>
  `Bearer ${signAccessToken({ sub, orgId, role, email: "fixture@example.invalid" })}`;
const donorApi = "/api/surveys";
const careApi = "/api/compassion/surveys";
const donorPublic = "/api/public/surveys";
const carePublic = "/api/compassion-public/surveys";
const makeDefinition = () => starterTemplates("DONOR")[0].definition;
type Survey = { id: string; organizationId: string; audience: string; identity: string; status: string;
  editVersion: number; published: number; closesAt: Date | null; draft: Definition; updatedAt: Date };
type Revision = { id: string; organizationId: string; surveyId: string; number: number; definition: Definition; publicKey: string | null; createdAt: Date };
type Invitation = { id: string; organizationId: string; revisionId: string; contactId: string; tokenHash: string | null;
  expiresAt: Date; completedAt: Date | null; revokedAt: Date | null };
type SavedResponse = { id: string; organizationId: string; revisionId: string; invitationId: string | null;
  donorId: string | null; clientId: string | null; submissionKey: string; payload: string };

const rows: Survey[] = [];
const revisions: Revision[] = [];
const invitations: Invitation[] = [];
const responses: SavedResponse[] = [];
const missing = new Error("Unexpected missing fixture");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("COMPASSION_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  [rows, revisions, invitations, responses].forEach(set => { set.length = 0; });
  db.$transaction.mockImplementation(async run => run(db));
  db.user.findFirst.mockImplementation(({ where }) => ({ role: where.id === "care" ? "compassion_user" : where.id, permissions: [] }));
  db.compassionMembership.findUnique.mockImplementation(({ where }) => where.organizationId_userId.userId === "care" ? { active: true, role: "ADMIN" } : null);
  db.organizationSettings.findUnique.mockResolvedValue({ donorWorkspaceEnabled: true, timezone: "America/Chicago" });
  db.organization.findUnique.mockResolvedValue({ name: "Synthetic organization" });
  db.compassionClient.findMany.mockImplementation(({ where }) => [
    { id: "care-contact", firstName: "Sample", lastName: "Client", email: "client@example.invalid", safeContact: { email: true } },
    { id: "care-optout", firstName: "Opted out", lastName: "Client", email: "optout@example.invalid", safeContact: { email: false } },
  ].filter(row => where.organizationId === "org-one" && (!where.id || where.id.in.includes(row.id))));
  db.survey.create.mockImplementation(({ data }) => {
    const row = { ...data, id: randomUUID(), status: "DRAFT", editVersion: 1, published: 0, closesAt: null, updatedAt: new Date() };
    rows.push(row);
    return row;
  });
  db.survey.findFirst.mockImplementation(({ where }) => rows.find(row => row.id === where.id &&
    row.organizationId === where.organizationId && where.audience.in.includes(row.audience)));
  db.survey.findUnique.mockImplementation(({ where }) => rows.find(row => row.id === where.organizationId_id.id &&
    row.organizationId === where.organizationId_id.organizationId));
  db.survey.update.mockImplementation(({ where, data }) => {
    const row = rows.find(item => item.id === where.id && item.organizationId === where.organizationId);
    if (!row) throw missing;
    Object.assign(row, data, { editVersion: typeof data.editVersion === "object" ? row.editVersion + data.editVersion.increment : row.editVersion });
    return row;
  });
  db.surveyRevision.create.mockImplementation(({ data }) => {
    const row = { ...data, id: randomUUID(), createdAt: new Date() };
    revisions.push(row);
    return row;
  });
  const revisionFor = ({ where }: { where: { organizationId_surveyId_number: { organizationId: string; surveyId: string; number: number } } }) =>
    revisions.find(row => row.organizationId === where.organizationId_surveyId_number.organizationId &&
      row.surveyId === where.organizationId_surveyId_number.surveyId && row.number === where.organizationId_surveyId_number.number);
  db.surveyRevision.findUnique.mockImplementation(revisionFor);
  db.surveyRevision.findUniqueOrThrow.mockImplementation(revisionFor);
  db.surveyRevision.findMany.mockImplementation(({ where }) => revisions.filter(row =>
    row.organizationId === where.organizationId && row.surveyId === where.surveyId).sort((a, b) => b.number - a.number));
  db.surveyRevision.findFirst.mockImplementation(({ where }) => {
    const row = revisions.find(item => item.publicKey === where.publicKey);
    const survey = rows.find(item => item.id === row?.surveyId && item.audience === where.survey.audience && item.identity === where.survey.identity);
    return row && survey ? { ...row, survey } : null;
  });
  db.surveyInvitation.findFirst.mockImplementation(({ where }) => {
    if (where.id) return invitations.find(item => item.id === where.id && item.organizationId === where.organizationId &&
      (!where.revision || revisions.find(rev => rev.id === item.revisionId)?.surveyId === where.revision.surveyId));
    const row = invitations.find(item => item.tokenHash === where.tokenHash);
    const revision = revisions.find(item => item.id === row?.revisionId);
    const survey = rows.find(item => item.id === revision?.surveyId && item.audience === where.revision.survey.audience &&
      item.identity === where.revision.survey.identity);
    return row && revision && survey ? { ...row, revision: { ...revision, survey } } : null;
  });
  db.surveyInvitation.findUnique.mockImplementation(({ where }) => {
    const criteria = where.organizationId_revisionId_contactId;
    return invitations.find(row => row.organizationId === criteria.organizationId && row.revisionId === criteria.revisionId && row.contactId === criteria.contactId);
  });
  db.surveyInvitation.create.mockImplementation(({ data }) => { invitations.push({ ...data, completedAt: null, revokedAt: null }); return data; });
  db.surveyInvitation.findMany.mockImplementation(({ where }) => invitations.filter(row =>
    row.organizationId === where.organizationId && row.revisionId === where.revisionId));
  db.surveyInvitation.update.mockImplementation(({ where, data }) => {
    const row = invitations.find(item => item.id === where.id && item.organizationId === where.organizationId);
    if (!row) throw missing;
    Object.assign(row, data);
    return row;
  });
  db.surveyResponse.create.mockImplementation(({ data }) => {
    responses.push({ ...data, invitationId: data.invitationId ?? null });
    return data;
  });
  db.surveyResponse.findUnique.mockImplementation(({ where }) => {
    const key = where.organizationId_revisionId_submissionKey;
    return responses.find(row => row.organizationId === key.organizationId && row.revisionId === key.revisionId && row.submissionKey === key.submissionKey);
  });
  db.surveyDeliveryJob.updateMany.mockResolvedValue({ count: 1 });
  db.surveyDeliveryJob.findMany.mockResolvedValue([]);
});

async function createSurvey(audience: "DONOR" | "CLIENT", identity: "ANONYMOUS" | "LINKED") {
  const api = audience === "CLIENT" ? careApi : donorApi;
  const auth = audience === "CLIENT" ? token("care", "org-one", "compassion_user") : token();
  const created = await request(app).post(api).set("Authorization", auth).send({ audience, identity }).expect(201);
  const id = created.body.id as string;
  await request(app).patch(`${api}/${id}`).set("Authorization", auth).send({ definition: makeDefinition(), editVersion: 1 }).expect(200);
  await request(app).post(`${api}/${id}/publish`).set("Authorization", auth).send({ editVersion: 2 }).expect(200);
  return { id, auth, api };
}

describe("Surveys API", () => {
  it("pins anonymous links to a published revision and stores idempotent responses without CRM identity", async () => {
    const { id, auth, api } = await createSurvey("DONOR", "ANONYMOUS");
    const original = revisions[0].publicKey!;
    expect(original).toHaveLength(43);
    const details = await request(app).get(`${api}/${id}`).set("Authorization", auth).expect(200);
    expect(details.body.revisions[0].path).toBe(`/s/respond#d.${original}`);
    await request(app).get(`${api}/${id}`).set("Authorization", token("manager", "org-two")).expect(404);
    await request(app).post(`${carePublic}/form`).send({ token: original }).expect(404);
    await request(app).patch(`${api}/${id}`).set("Authorization", auth)
      .send({ definition: makeDefinition(), editVersion: 2, identity: "LINKED" }).expect(422);
    await request(app).patch(`${api}/${id}`).set("Authorization", auth)
      .send({ definition: { ...makeDefinition(), title: "Second revision" }, editVersion: 1 }).expect(409);
    await request(app).patch(`${api}/${id}`).set("Authorization", auth)
      .send({ definition: { ...makeDefinition(), title: "Second revision" }, editVersion: 2 }).expect(200);
    await request(app).post(`${api}/${id}/publish`).set("Authorization", auth).send({ editVersion: 3 }).expect(200);
    const originalForm = await request(app).post(`${donorPublic}/form`).send({ token: original }).expect(200);
    expect(originalForm.body.definition.title).toBe("Donor experience");
    expect(originalForm.headers["cache-control"]).toBe("no-store");
    const secondForm = await request(app).post(`${donorPublic}/form`).send({ token: revisions[1].publicKey }).expect(200);
    expect(secondForm.body.definition.title).toBe("Second revision");
    await request(app).post(`${donorPublic}/responses`).send({ token: original, submissionKey: randomUUID(), answers: {} }).expect(422);
    const response = { token: original, submissionKey: randomUUID(), answers: { rating: 5, "follow-up": "hidden", donorId: "forged" } };
    await request(app).post(`${donorPublic}/responses`).send(response).expect(201);
    await request(app).post(`${donorPublic}/responses`).send(response).expect(200);
    await request(app).post(`${donorPublic}/responses`).send({ ...response, answers: { rating: 2 } }).expect(409);
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({ donorId: null, clientId: null, invitationId: null, revisionId: revisions[0].id,
      submissionKey: digest(response.submissionKey), payload: '{"rating":5}' });
    await request(app).post(`${api}/${id}/close`).set("Authorization", auth).send({}).expect(200);
    await request(app).post(`${donorPublic}/form`).send({ token: original }).expect(410);
    await request(app).post(`${donorPublic}/responses`).send({ ...response, submissionKey: randomUUID() }).expect(410);
    await request(app).post(`${api}/${id}/archive`).set("Authorization", auth).send({}).expect(200);
    expect(responses).toHaveLength(1);
  });

  it("separates Compassion from donor access and seals one response per personal link", async () => {
    const { id, auth, api } = await createSurvey("CLIENT", "LINKED");
    await request(app).get(`${donorApi}/${id}`).set("Authorization", token()).expect(404);
    await request(app).get(`${api}/${id}`).set("Authorization", token()).expect(404);
    await request(app).get(`${donorApi}/access`).set("Authorization", auth).expect(403);
    const issued = await request(app).post(`${api}/${id}/personal-link`).set("Authorization", auth)
      .send({ contactId: "care-contact" }).expect(200);
    const raw = issued.body.path.split("#c.")[1];
    expect(invitations[0].tokenHash).toBe(digest(raw));
    await request(app).post(`${donorPublic}/form`).send({ token: raw }).expect(404);
    await request(app).post(`${carePublic}/form`).send({ token: raw }).expect(200);
    const response = { token: raw, submissionKey: randomUUID(), answers: { rating: 2, "follow-up": "Synthetic client feedback" } };
    await request(app).post(`${carePublic}/responses`).send(response).expect(201);
    await request(app).post(`${carePublic}/responses`).send({ ...response, submissionKey: randomUUID() }).expect(409);
    expect(responses[0]).toMatchObject({ donorId: null, clientId: "care-contact", invitationId: invitations[0].id });
    expect(responses[0].payload).toMatch(/^v1\./);
    expect(responses[0].payload).not.toContain("Synthetic client feedback");
    const revoked = await request(app).post(`${api}/${id}/personal-link`).set("Authorization", auth)
      .send({ contactId: "care-optout" }).expect(200);
    await request(app).post(`${api}/${id}/invitations/${invitations[1].id}/revoke`).set("Authorization", auth).send({}).expect(200);
    await request(app).post(`${carePublic}/form`).send({ token: revoked.body.path.split("#c.")[1] }).expect(404);
  });

  it("requires exact invitation review and excludes clients without safe email permission", async () => {
    const { id, auth, api } = await createSurvey("CLIENT", "ANONYMOUS");
    const endpoint = `${api}/${id}/distributions`;
    const draft = { contactIds: ["care-contact", "care-optout"], subject: "Feedback", message: "Please share feedback.", reminderDays: 7 };
    const reviewed = await request(app).post(`${endpoint}/review`).set("Authorization", auth).send(draft).expect(200);
    expect(reviewed.body.ready).toBe(1);
    expect(reviewed.body.rows.find((row: { id: string }) => row.id === "care-optout").excluded).toContain("Safe email");
    const payload = { ...draft, requestKey: randomUUID(), reviewHash: reviewed.body.reviewHash };
    await request(app).post(endpoint).set("Authorization", auth).send({ ...payload, subject: "Changed subject" }).expect(409);
    expect(db.surveyInvitation.createMany).not.toHaveBeenCalled();
    db.surveyDistribution.create.mockImplementation(({ data }) => ({ id: "batch", ...data }));
    await request(app).post(endpoint).set("Authorization", auth).send(payload).expect(202);
    const saved = db.surveyDistribution.create.mock.results[0].value;
    db.surveyDistribution.findUnique.mockResolvedValue({ ...saved, revision: { surveyId: id } });
    await request(app).post(endpoint).set("Authorization", auth).send(payload).expect(202);
    await request(app).post(endpoint).set("Authorization", auth).send({ ...payload, message: "A changed message" }).expect(409);
    expect(db.surveyDistribution.create).toHaveBeenCalledTimes(1);
    expect(db.surveyInvitation.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ contactId: "care-contact", tokenHash: null })]);
    expect(db.surveyDeliveryJob.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ reminder: false }), expect.objectContaining({ reminder: true }),
    ]);
    expect(fakeSend).not.toHaveBeenCalled();
  });

  it("rejects absent, invalid, expired and revoked public tokens with safe errors", async () => {
    await request(app).post(`${donorPublic}/form`).send({}).expect(404);
    await request(app).post(`${donorPublic}/form`).send({ token: "invalid" }).expect(404);
    const { api, id, auth } = await createSurvey("CLIENT", "LINKED");
    const issued = await request(app).post(`${api}/${id}/personal-link`).set("Authorization", auth)
      .send({ contactId: "care-contact" }).expect(200);
    const token = issued.body.path.split("#c.")[1];
    invitations[0].expiresAt = new Date(0);
    await request(app).post(`${carePublic}/form`).send({ token }).expect(404);
    await request(app).post(`${carePublic}/responses`).send({ token, submissionKey: randomUUID(), answers: { rating: 4 } }).expect(404);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.surveyInvitation.findFirst.mockRejectedValueOnce(new Error("Synthetic SQL with sensitive payload"));
    const result = await request(app).post(`${donorPublic}/form`).send({ token: "Z".repeat(43) }).expect(503);
    expect(JSON.stringify(result.body)).not.toContain("sensitive");
    expect(log).toHaveBeenCalledWith("[surveys] Public form request failed.");
    log.mockRestore();
  });

  it("enforces manager publishing and explicit permission denials", async () => {
    const { api, id } = await createSurvey("DONOR", "ANONYMOUS");
    await request(app).post(`${api}/${id}/publish`).set("Authorization", token("staff", "org-one", "staff"))
      .send({ editVersion: 2 }).expect(403);
    await request(app).patch(`${api}/${id}`).set("Authorization", token("readonly", "org-one", "readonly"))
      .send({ editVersion: 2, definition: makeDefinition() }).expect(403);
    db.user.findFirst.mockResolvedValue({ role: "admin", permissions: [{ permission: "surveys.view", granted: false }] });
    await request(app).get(`${api}/${id}`).set("Authorization", token()).expect(404);
  });

  it("keeps anonymous reminder emails shared and marks uncertain provider acceptance for review", async () => {
    const job = { id: "reminder", organizationId: "org-one", status: "SENDING", reminder: true, invitation: {
      id: "invite", contactId: "care-contact", addressHash: digest("client@example.invalid"), completedAt: null, revokedAt: null,
      expiresAt: new Date(Date.now() + 86400_000), tokenHash: null,
      distribution: { actorId: "care", sender: "Fixture sender <sender@example.invalid>", origin: "http://localhost:3000",
        message: "Give feedback <script>unsafe</script>", subject: "Feedback" },
      revision: { publicKey: "B".repeat(43), survey: { status: "LIVE", audience: "CLIENT", identity: "ANONYMOUS", closesAt: null } },
    } };
    db.surveyDeliveryJob.findMany.mockResolvedValue([{ id: job.id, organizationId: "org-one" }]);
    db.surveyDeliveryJob.findFirstOrThrow.mockResolvedValue(job);
    db.surveyDeliveryJob.findFirst.mockImplementation(({ where }) => where.reminder === false ? { status: "SENT" } : job);
    fakeSend.mockRejectedValueOnce(new Error("Provider timeout"));
    await processSurveyDeliveries("CLIENT");
    expect(fakeSend).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("If you already completed the survey, please disregard"),
      html: expect.stringContaining("&lt;script&gt;unsafe&lt;/script&gt;"),
    }));
    expect(fakeSend.mock.calls[0][0].text).toContain(`/s/respond#c.${"B".repeat(43)}`);
    expect(db.surveyDeliveryJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "UNKNOWN" }),
    }));
    db.surveyDeliveryJob.findMany.mockResolvedValue([]);
    await processSurveyDeliveries("CLIENT");
    expect(fakeSend).toHaveBeenCalledTimes(1);
  });

  it("skips scheduled linked reminders after completion and never reads the other worker lane", async () => {
    const survey = { status: "LIVE", closesAt: null, audience: "CLIENT", identity: "LINKED" };
    db.surveyDeliveryJob.findMany.mockResolvedValue([{ id: "reminder", organizationId: "org-one" }]);
    db.surveyDeliveryJob.findFirstOrThrow.mockResolvedValue({ reminder: true, invitation: {
      id: "invite", completedAt: new Date(), expiresAt: new Date(Date.now() + 86400_000), revokedAt: null,
      revision: { survey }, distribution: { actorId: "care" },
    } });
    await processSurveyDeliveries("CLIENT");
    expect(db.surveyDeliveryJob.findMany.mock.calls[0][0].where.invitation.revision.survey.audience).toBe("CLIENT");
    expect(db.surveyDeliveryJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SKIPPED" }),
    }));
    expect(fakeSend).not.toHaveBeenCalled();
  });
});
