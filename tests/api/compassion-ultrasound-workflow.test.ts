/** Real HTTP/authorization/encryption handlers; synthetic persistence, no live care records. */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { careRows, resetCareRows } from "../helpers/compassion-memory-database";

vi.mock("@/server/src/compassion/database", async () => {
  const { careMemoryDatabase } = await import("../helpers/compassion-memory-database");
  return { prisma: careMemoryDatabase, compassionDatabase: careMemoryDatabase, atomic: async (_org: string, work: () => Promise<unknown>) => work() };
});

import app from "@/server/src/compassion/app";
import { signAccessToken } from "@/server/src/lib/auth";

const orgId = "synthetic-care-org";
const sample = { examDate: "2026-11-03", indication: "Test visit", findings: "Protected test findings", impression: "Clinician-entered test impression", followUp: "Recorded test plan" };
const auth = (who = "clinician", organizationId = orgId) => signAccessToken({ sub: who, email: `${who}@example.invalid`, role: "staff", orgId: organizationId });
const call = (method: "get" | "post" | "patch", path: string, body?: unknown, who = "clinician") => {
  const req = request(app)[method](`/api/compassion${path}`).set("Authorization", `Bearer ${auth(who)}`);
  const chartId = /^\/charts\/([^/]+)/.exec(path)?.[1];
  const chart = chartId ? careRows.compassionChart?.find(c=>c.id===chartId) : null;
  const payload = body && typeof body === "object" && chart?.kind === "ULTRASOUND" && !Object.hasOwn(body,"expectedUpdatedAt") ? { ...body, expectedUpdatedAt: (chart.updatedAt as Date).toISOString() } : body;
  return payload === undefined ? req : req.send(payload as object);
};
const create = (content: Record<string, unknown> = sample) => call("post", "/charts", { clientId: "client", kind: "ULTRASOUND", content });
const scan = (id: string, who = "clinician") => call("post", "/documents", { clientId: "client", chartId: id, name: "synthetic-scan.png", mimeType: "image/png", base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1sAAAAASUVORK5CYII=" }, who);

beforeEach(() => {
  resetCareRows(); process.env.COMPASSION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  careRows.user = ["clinician", "physician", "admin", "caseworker", "reception", "donor", "inactive"].map((who) => ({ id: who, organizationId: orgId, active: who !== "inactive", role: "staff", firstName: "Synthetic", lastName: who }));
  careRows.compassionMembership = ["clinician", "physician", "admin", "caseworker", "reception", "inactive"].map((who) => ({ userId: who, organizationId: orgId, role: who === "inactive" ? "CLINICIAN" : who.toUpperCase(), active: true }));
  careRows.compassionClient = [{ id: "client", organizationId: orgId, firstName: "Avery", lastName: "Morgan" }, { id: "foreign-client", organizationId: "foreign", firstName: "Other", lastName: "Tenant" }];
  careRows.compassionAppointment = [{ id: "appointment", organizationId: orgId, clientId: "client", appointmentType: "ULTRASOUND", startTime: new Date("2026-11-03T15:00:00Z"), status: "SCHEDULED", location: "Test room" }, { id: "foreign-appointment", organizationId: "foreign", clientId: "foreign-client", appointmentType: "ULTRASOUND" }];
});

describe("Compassion ultrasound HTTP workflow", () => {
  it("requires clinical membership and protects tenant boundaries", async () => {
    expect((await request(app).get("/api/compassion/ultrasounds")).status).toBe(401);
    for (const who of ["reception", "caseworker", "donor"]) expect((await call("get", "/ultrasounds", undefined, who)).status).toBe(403);
    expect((await call("post", "/charts", { clientId: "foreign-client", kind: "ULTRASOUND", content: sample })).status).toBe(404);
    expect((await call("get", "/ultrasounds?clientId=foreign-client")).status).toBe(404);
    expect((await create({ ...sample, appointmentId: "foreign-appointment" })).status).toBe(400);
  });

  it("lists encrypted exam summaries with appointment and attachment metadata", async () => {
    const created = await create({ ...sample, performedBy: "Test clinician", appointmentId: "appointment" });
    expect(created.status).toBe(201); const id = created.body.id;
    expect((await scan(id)).status).toBe(201);
    const list = await call("get", "/ultrasounds?search=Avery%20Morgan");
    expect(list.status).toBe(200); expect(list.body.total).toBe(1); expect(list.body.counts.DRAFT).toBe(1);
    expect(list.body.items[0]).toMatchObject({ id, client: { firstName: "Avery" }, appointment: { id: "appointment" }, attachmentCount: 1 });
    expect(JSON.stringify(list.body)).not.toContain(sample.findings);
    expect(String(careRows.compassionChart[0].encryptedContent)).not.toContain(sample.findings);
    expect((await call("get", "/ultrasounds?page=0")).status).toBe(400);
    expect((await call("get", "/ultrasounds?status=UNKNOWN")).status).toBe(400);
  });

  it("allows incomplete drafts, blocks incomplete submission, and restricts edits and scans to the author", async () => {
    const draft = await create({ examDate: "2026-11-03" }); const id = draft.body.id;
    expect(draft.status).toBe(201);
    expect((await call("post", `/charts/${id}/submit`, {})).status).toBe(400);
    expect((await call("patch", `/charts/${id}`, { content: sample }, "admin")).status).toBe(400);
    expect((await scan(id, "admin")).status).toBe(400);
    expect((await call("patch", `/charts/${id}`, { content: sample, expectedUpdatedAt: "stale" })).status).toBe(409);
    expect((await call("patch", `/charts/${id}`, { content: sample })).status).toBe(200);
    expect((await call("post", `/charts/${id}/submit`, {})).status).toBe(400);
    expect((await scan(id)).status).toBe(201);
    expect((await call("post", `/charts/${id}/submit`, {})).status).toBe(200);
  });

  it("paginates the worklist and keeps status totals independent of the selected queue", async () => {
    for (let i = 0; i < 27; i++) expect((await create()).status).toBe(201);
    const first = await call("get", "/ultrasounds?page=1"); const second = await call("get", "/ultrasounds?page=2");
    expect(first.body.items).toHaveLength(25); expect(second.body.items).toHaveLength(2);
    expect(first.body.total).toBe(27); expect(first.body.counts.DRAFT).toBe(27);
    const review = await call("get", "/ultrasounds?status=REVIEW");
    expect(review.body.total).toBe(0); expect(review.body.counts.DRAFT).toBe(27);
  });

  it("returns an unsigned chart with encrypted feedback, then signs an immutable report", async () => {
    const { body: { id } } = await create(); await scan(id); await call("post", `/charts/${id}/submit`, {});
    expect((await call("post", `/charts/${id}/return`, { reason: "Clarify the recorded finding" }, "admin")).status).toBe(403);
    expect((await call("post", `/charts/${id}/return`, { reason: "" }, "physician")).status).toBe(400);
    expect((await call("post", `/charts/${id}/return`, { reason: "Clarify the recorded finding" }, "physician")).status).toBe(200);
    const returned = await call("get", `/charts/${id}`);
    expect(returned.body.status).toBe("DRAFT"); expect(returned.body.content._review.reason).toBe("Clarify the recorded finding");
    expect(String(careRows.compassionChart[0].encryptedContent)).not.toContain("Clarify the recorded finding");
    await call("patch", `/charts/${id}`, { content: { ...sample, findings: "Corrected test findings" } });
    expect((await call("get", `/charts/${id}`)).body.content._review.reason).toBe("Clarify the recorded finding");
    await call("post", `/charts/${id}/submit`, {});
    expect((await call("post", `/charts/${id}/sign`, { attest: true }, "admin")).status).toBe(403);
    expect((await call("post", `/charts/${id}/sign`, { attest: false }, "physician")).status).toBe(400);
    expect((await call("post", `/charts/${id}/sign`, { attest: true }, "physician")).status).toBe(200);
    expect((await call("get", `/charts/${id}/report`)).body.content.findings).toBe("Corrected test findings");
    expect((await call("get", `/charts/${id}/report`)).body.content._review).toBeUndefined();
    expect((await call("patch", `/charts/${id}`, { content: sample })).status).toBe(400);
    expect((await call("post", `/charts/${id}/return`, { reason: "Too late" }, "physician")).status).toBe(400);
    const amendment = await call("post", "/charts", { clientId: "client", kind: "ULTRASOUND", previousId: id, content: { ...sample, amendmentReason: "Correct the signed examination" } });
    expect(amendment.status).toBe(201);
    expect(careRows.compassionChart.find(chart => chart.id === id)?.status).toBe("SIGNED");
    expect(careRows.compassionChart.find(chart => chart.id === amendment.body.id)).toMatchObject({ version: 2, previousId: id, status: "DRAFT" });
    expect((await call("patch", `/charts/${amendment.body.id}`, { content: sample })).status).toBe(400);
  });

  it("creates a reviewed chart-linked task without exposing findings or modifying a signed chart", async () => {
    const { body: { id } } = await create(); await scan(id); await call("post", `/charts/${id}/submit`, {}); await call("post", `/charts/${id}/sign`, { attest: true }, "physician");
    const encrypted = careRows.compassionChart[0].encryptedContent;
    const body = { approve: true, dueDate: "2026-11-05T18:00:00Z", priority: "HIGH", assignedStaffId: "clinician" };
    expect((await call("post", `/ultrasounds/${id}/follow-ups`, { ...body, approve: false })).status).toBe(400);
    expect((await call("post", `/ultrasounds/${id}/follow-ups`, { ...body, assignedStaffId: "donor" })).status).toBe(400);
    expect((await call("post", `/ultrasounds/${id}/follow-ups`, { ...body, assignedStaffId: "inactive" })).status).toBe(400);
    const created = await call("post", `/ultrasounds/${id}/follow-ups`, body);
    expect(created.status).toBe(201); expect(careRows.compassionFollowUp[0]).toMatchObject({ chartId: id, title: "Client-care follow-up", assignedStaffId: "clinician" });
    expect(careRows.compassionChart[0].encryptedContent).toBe(encrypted);
    expect((await call("post", `/ultrasounds/${id}/follow-ups`, body)).status).toBe(409);
    expect((await call("get", `/follow-ups?chartId=${id}`, undefined, "caseworker")).body).toHaveLength(1);
    expect((await call("patch", `/follow-ups/${created.body.id}`, { assignedStaffId: "donor" })).status).toBe(400);
    await call("patch", `/follow-ups/${created.body.id}`, { status: "COMPLETED" });
    expect(careRows.compassionFollowUp[0].completedAt).toBeInstanceOf(Date);
    expect((await call("post", `/ultrasounds/${id}/follow-ups`, body)).status).toBe(201);
    expect((await call("patch", `/follow-ups/${created.body.id}`, { status: "PENDING" })).status).toBe(409);
  });

  it("keeps pending, in-progress, and persisted overdue tasks visible, and clears completion on reopening", async () => {
    careRows.compassionFollowUp = ["PENDING", "IN_PROGRESS", "OVERDUE", "COMPLETED"].map((status, index) => ({ id: `task-${index}`, clientId: "client", organizationId: orgId, status, title: "Synthetic task", priority: "MEDIUM", dueDate: new Date("2020-01-01"), chartId: null, assignedStaffId: "clinician" }));
    expect((await call("get", "/follow-ups?status=OPEN")).body).toHaveLength(3);
    expect((await call("get", "/follow-ups?status=OVERDUE")).body).toHaveLength(3);
    expect((await call("get", "/today")).body.followUps).toHaveLength(3);
    expect((await call("get", "/follow-ups?status=INVALID")).status).toBe(400);
    expect((await call("get", "/follow-ups?limit=-1")).status).toBe(400);
    expect((await call("patch", "/follow-ups/task-3", { status: "IN_PROGRESS" })).status).toBe(200);
    expect(careRows.compassionFollowUp[3].completedAt).toBeNull();
  });
});
