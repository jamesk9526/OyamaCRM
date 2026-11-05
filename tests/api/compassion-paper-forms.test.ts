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

const auth = (who = "clinician", organizationId = orgId) => signAccessToken({ sub: who, email: `${who}@example.invalid`, role: "staff", orgId: organizationId });
const call = (method: "get" | "post" | "patch", path: string, body?: unknown, who = "clinician") => {
  const req = request(app)[method](`/api/compassion${path}`).set("Authorization", `Bearer ${auth(who)}`);
  return body === undefined ? req : req.send(body as object);
};
beforeEach(() => {
  resetCareRows(); process.env.COMPASSION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  careRows.user = ["clinician", "physician", "admin", "caseworker", "reception", "donor", "inactive"].map((who) => ({ id: who, organizationId: orgId, active: who !== "inactive", role: "staff", firstName: "Synthetic", lastName: who }));
  careRows.compassionMembership = ["clinician", "physician", "admin", "caseworker", "reception", "inactive"].map((who) => ({ userId: who, organizationId: orgId, role: who === "inactive" ? "CLINICIAN" : who.toUpperCase(), active: true }));
  careRows.compassionClient = [{ id: "client", organizationId: orgId, firstName: "Avery", lastName: "Morgan" }, { id: "foreign-client", organizationId: "foreign", firstName: "Other", lastName: "Tenant" }];
  careRows.compassionAppointment = [{ id: "appointment", organizationId: orgId, clientId: "client", appointmentType: "ULTRASOUND", startTime: new Date("2026-11-03T15:00:00Z"), status: "SCHEDULED", location: "Test room" }, { id: "foreign-appointment", organizationId: "foreign", clientId: "foreign-client", appointmentType: "ULTRASOUND" }];
});


describe("Compassion paper forms HTTP boundary", () => {
  it("records walk-ins once, links delivered services and excludes drafts from monthly totals", async () => {
    const body = { clientId: "client", recordKey: "retry-visit", visitDate: "2026-11-05", location: "Aurora" };
    const created = await call("post", "/visits", body, "caseworker");
    expect(created.status).toBe(201);
    expect((await call("post", "/visits", body, "caseworker")).body.id).toBe(created.body.id);
    expect(careRows.compassionVisit).toHaveLength(1);
    const visit = (await call("get", "/visits?clientId=client", undefined, "caseworker")).body[0];
    expect((await call("patch", `/visits/${visit.id}`, { expectedUpdatedAt: "stale", status: "COMPLETED" }, "caseworker")).status).toBe(409);
    expect((await call("patch", `/visits/${visit.id}`, { expectedUpdatedAt: visit.updatedAt, status: "COMPLETED", metrics: { pregnant: true } }, "caseworker")).status).toBe(403);
    const service = { sourceKey: "retry-service", serviceType: "DIAPERS", quantity: 12 };
    expect((await call("post", `/visits/${visit.id}/services`, service, "caseworker")).status).toBe(201);
    expect((await call("post", `/visits/${visit.id}/services`, service, "caseworker")).status).toBe(200);
    expect(careRows.compassionService).toHaveLength(1);
    const before = await call("get", "/reports/monthly?month=2026-11", undefined, "admin");
    expect(before.status).toBe(200); expect(before.body.totals.supplies).toBe(0);
    expect((await call("patch", `/visits/${visit.id}`, { expectedUpdatedAt: visit.updatedAt, status: "COMPLETED", metrics: { spiritual: true } }, "caseworker")).status).toBe(200);
    const after = await call("get", "/reports/monthly?month=2026-11", undefined, "admin");
    expect(after.body.totals).toMatchObject({ attendedVisits: 1, completedVisits: 1, uniqueClients: 1, supplies: 12 });
    expect(after.body.totals.metrics.spiritual).toBeNull();
    expect((await call("get", "/reports/monthly?month=2026-11", undefined, "caseworker")).status).toBe(403);
  });
  it("rejects missing and foreign bookings and invalid calendar dates", async () => {
    for (const extra of [{ appointmentId: "foreign-appointment" }, { appointmentId: "missing" }, { visitDate: "2026-02-30" }]) {
      expect((await call("post", "/visits", { clientId: "client", recordKey: "key", visitDate: "2026-11-05", location: "Aurora", ...extra })).status).toBe(400);
    }
    expect((await call("get", "/reports/monthly?month=2026-13", undefined, "admin")).status).toBe(400);
  });
  it("separates casework signed originals from clinical attachments", async () => {
    const created = await call("post", "/case-forms", { clientId: "client", kind: "CASE_INTAKE", answers: {} }, "caseworker");
    const body = { name: "signed-original.pdf", mimeType: "application/pdf", base64: Buffer.from("%PDF-synthetic-test-only").toString("base64") };
    expect((await call("post", `/case-forms/${created.body.id}/documents`, body, "caseworker")).status).toBe(400);
    const uploaded = await call("post", `/case-forms/${created.body.id}/documents`, { ...body, confirmCaseworkOnly: true }, "caseworker");
    expect(uploaded.status).toBe(201);
    expect((await call("get", `/case-form-documents/${uploaded.body.id}/download`, undefined, "caseworker")).body.base64).toBe(body.base64);
    careRows.compassionDocument.push({ ...careRows.compassionDocument[0], id: "clinical-document", accessScope: "CLINICAL" });
    expect((await call("get", "/case-form-documents/clinical-document/download", undefined, "caseworker")).status).toBe(404);
    expect((await call("get", `/case-form-documents/${uploaded.body.id}/download`, undefined, "reception")).status).toBe(403);
  });
  it("encrypts casework drafts and preserves revision history", async () => {
    const created = await call("post", "/case-forms", { clientId: "client", kind: "CASE_INTAKE", answers: { firstName: "Protected answer" } }, "caseworker");
    expect(created.status).toBe(201);
    expect(String(careRows.compassionFormRecord[0].encryptedAnswers)).not.toContain("Protected answer");
    const id = created.body.id;
    expect((await call("patch", `/case-forms/${id}`, { expectedVersion: 0, answers: {} }, "caseworker")).status).toBe(409);
    expect((await call("patch", `/case-forms/${id}`, { expectedVersion: 1, answers: { firstName: "Revised" } }, "caseworker")).status).toBe(200);
    const history = await call("get", `/case-forms/${id}/revisions`, undefined, "caseworker");
    expect(history.body[0].answers.firstName).toBe("Protected answer");
    expect(careRows.compassionFormRecord[0].version).toBe(2);
  });
  it("rejects reception, clinical bypass, cross-tenant and mismatched links", async () => {
    const body = { clientId: "client", kind: "CASE_INTAKE", answers: {} };
    expect((await call("post", "/case-forms", body, "reception")).status).toBe(403);
    expect((await call("post", "/case-forms", { ...body, kind: "HEALTH_PREGNANCY_INTAKE" }, "caseworker")).status).toBe(400);
    expect((await call("post", "/case-forms", { ...body, clientId: "foreign-client" }, "caseworker")).status).toBe(404);
    expect((await call("post", "/case-forms", { ...body, visitId: "missing" })).status).toBe(400);
    expect((await call("post", "/charts", { clientId: "client", kind: "HEALTH_PREGNANCY_INTAKE", content: { answers: {} } }, "caseworker")).status).toBe(403);
  });
  it("keeps contradictory marks in a draft and requires review before completion", async () => {
    const answers = { phonePermission: ["No contact by phone", "OK to call"] };
    const created = await call("post", "/case-forms", { clientId: "client", kind: "CASE_INTAKE", answers });
    expect(created.status).toBe(201);
    expect((await call("patch", `/case-forms/${created.body.id}`, { expectedVersion: 1, answers, status: "COMPLETE" })).status).toBe(400);
    expect((await call("get", `/case-forms/${created.body.id}`)).body.answers).toEqual(answers);
  });
  it("requires a reviewed version before updating the profile", async () => {
    const created = await call("post", "/case-forms", { clientId: "client", kind: "CASE_INTAKE", answers: { firstName: "New name", phonePermission: ["No contact by phone"] } });
    expect(careRows.compassionClient[0].firstName).toBe("Avery");
    const path = `/case-forms/${created.body.id}/apply-profile`;
    expect((await call("post", path, { approve: true, expectedVersion: 0 })).status).toBe(400);
    expect((await call("post", path, { approve: true, expectedVersion: 1 })).status).toBe(200);
    expect(careRows.compassionClient[0]).toMatchObject({ firstName: "New name", safeContact: { phone: false, sms: false, voicemail: false, email: false } });
  });
  it("retains the full health form in one chart and enforces review fields", async () => {
    const created = await call("post", "/charts", { clientId: "client", kind: "HEALTH_PREGNANCY_INTAKE", content: { answers: { name: "Avery" } } });
    expect(created.status).toBe(201);
    expect((await call("post", `/charts/${created.body.id}/submit`, {})).status).toBe(400);
    expect((await call("patch", `/charts/${created.body.id}`, { content: { answers: { name: "Avery", visitDate: "2026-11-05", testStaff: "Test staff", testResult: "Negative", testType: "Initial Test" } } })).status).toBe(200);
    expect((await call("post", `/charts/${created.body.id}/submit`, {})).status).toBe(200);
    expect(careRows.compassionChart).toHaveLength(1);
    const row = await call("get", `/charts/${created.body.id}`);
    expect(row.body.content.templateSource).toBe("client health and pregna.pdf");
  });
});
