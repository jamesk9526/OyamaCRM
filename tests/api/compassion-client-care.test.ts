import "dotenv/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import app from "@/server/src/compassion/app";
import { compassionDatabase as db } from "@/server/src/compassion/database";
import { signAccessToken } from "@/server/src/lib/auth";

const suffix = randomBytes(8).toString("hex");
const orgId = `care_test_${suffix}`; const foreignOrgId = `care_foreign_${suffix}`;
const token = (user: string, role = "staff") => signAccessToken({ sub: `${suffix}_${user}`, email: `${suffix}_${user}@example.invalid`, role, orgId });
const admin = token("admin"); const clinician = token("clinician"); const physician = token("physician"); const donor = token("donor", "admin");
let clientId = ""; let chartId = "";
const call = (method: "get" | "post" | "patch" | "put" | "delete", path: string, body?: unknown, auth = admin) => {
  const req = request(app)[method](`/api/compassion${path}`).set("Authorization", `Bearer ${auth}`);
  return body === undefined ? req : req.send(body as object);
};
beforeAll(async () => {
  process.env.COMPASSION_ENCRYPTION_KEY ||= randomBytes(32).toString("hex");
  await db.organization.createMany({ data: [{ id: orgId, name: "Compassion isolated API test" }, { id: foreignOrgId, name: "Compassion foreign test" }] });
  for (const who of ["admin", "clinician", "physician", "caseworker", "donor"]) {
    await db.user.create({ data: { id: `${suffix}_${who}`, organizationId: orgId, email: `${suffix}_${who}@example.invalid`, firstName: "Care", lastName: who, role: who === "donor" ? "admin" : "staff" } });
    if (who !== "donor") await db.compassionMembership.create({ data: { organizationId: orgId, userId: `${suffix}_${who}`, role: who.toUpperCase() } });
  }
}, 30000);
afterAll(async () => {
  // Delete only disposable records created by this suite, respecting recovered foreign keys.
  for (const model of [db.compassionClientRedirect, db.compassionConfiguration, db.compassionAudit, db.compassionPortalAccess, db.compassionMessage, db.compassionIntake, db.compassionDocument, db.compassionChart, db.compassionReservation, db.compassionResource, db.compassionImportBatch, db.compassionEnrollment, db.compassionPointEntry, db.compassionClass, db.compassionStaffHours, db.compassionActivity, db.compassionFollowUp, db.compassionService, db.compassionAppointment, db.compassionCase, db.compassionClient, db.compassionStaff, db.compassionMembership, db.compassionScheduleLock] as const) {
    await (model.deleteMany as unknown as (args: { where: { organizationId: { in: string[] } } }) => Promise<unknown>)({ where: { organizationId: { in: [orgId, foreignOrgId] } } });
  }
  await db.user.deleteMany({ where: { organizationId: orgId } });
  await db.organization.deleteMany({ where: { id: { in: [orgId, foreignOrgId] } } });
  await db.$disconnect();
}, 30000);

describe("separate Compassion API", () => {
  it("does not mount donor endpoints and denies donor-only administrators", async () => {
    expect((await request(app).get("/api/constituents")).status).toBe(404);
    expect((await call("get", "/clients", undefined, donor)).status).toBe(403);
    expect((await request(app).get("/api/compassion/clients")).status).toBe(401);
    expect((await call("get", "/access")).body.role).toBe("ADMIN");
  });
  it("creates a client only in the authenticated organization", async () => {
    const result = await call("post", "/clients", { firstName: "Test", lastName: "Client", organizationId: foreignOrgId });
    expect(result.status).toBe(201); clientId = result.body.id;
    expect(result.body.organizationId).toBe(orgId);
    expect(await db.compassionClient.count({ where: { organizationId: foreignOrgId } })).toBe(0);
    expect((await call("get", "/today")).status).toBe(200);
  });
  it("creates care-only staff accounts without granting donor/reporting roles", async () => {
    const staff = await call("post", "/staff", { firstName: "Care", lastName: "Reception" }); expect(staff.status).toBe(201);
    const created = await call("post", `/staff/${staff.body.id}/create-account`, { email: `reception_${suffix}@example.invalid`, password: "CareTest123!", role: "admin" }); expect(created.status).toBe(201);
    expect(created.body.account.role).toBe("compassion_user");
    const access = signAccessToken({ sub: created.body.account.id, email: created.body.account.email, role: "compassion_user", orgId });
    expect((await call("get", "/access", undefined, access)).body.role).toBe("RECEPTION");
    expect((await call("get", "/charts", undefined, access)).status).toBe(403);
    expect((await call("get", "/appointments", undefined, access)).status).toBe(200);
    expect((await call("get", "/clients", undefined, access)).status).toBe(200);
  });
  it("keeps historical medical services behind clinical access", async () => {
    const clinicalService = await call("post", "/services", { clientId, serviceType: "PREGNANCY_TEST", notes: "Confidential historical medical service" }, clinician);
    expect(clinicalService.status).toBe(201);
    const caseworker = token("caseworker");
    const directory = await call("get", `/services?clientId=${clientId}`, undefined, caseworker);
    expect(directory.status).toBe(200); expect(JSON.stringify(directory.body)).not.toContain("Confidential historical medical service");
    const detail = await call("get", `/clients/${clientId}`, undefined, caseworker);
    expect(detail.status).toBe(200); expect(JSON.stringify(detail.body)).not.toContain("Confidential historical medical service"); expect(detail.body.constituentId).toBeUndefined();
    expect((await call("patch", `/services/${clinicalService.body.id}`, { notes: "Unauthorized edit" }, caseworker)).status).toBe(403);
    expect((await call("delete", `/services/${clinicalService.body.id}`, undefined, caseworker)).status).toBe(403);
  });
  it("serializes overlapping appointments across concurrent requests", async () => {
    const startTime = "2027-02-10T15:00:00.000Z";
    const results = await Promise.all([call("post", "/appointments", { clientId, startTime, durationMinutes: 60 }), call("post", "/appointments", { clientId, startTime, durationMinutes: 60, allowConflict: true })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.compassionAppointment.count({ where: { organizationId: orgId } })).toBe(1);
  });
  it("blocks cross-client resource conflicts and invalid resource ownership", async () => {
    const resource = await call("post", "/resources", { name: "Test ultrasound", kind: "EQUIPMENT" }); expect(resource.status).toBe(201);
    const second = await call("post", "/clients", { firstName: "Other", lastName: "Client" });
    const startTime = "2027-02-11T15:00:00.000Z";
    expect((await call("post", "/appointments", { clientId, startTime, durationMinutes: 60, resourceIds: [resource.body.id] })).status).toBe(201);
    expect((await call("post", "/appointments", { clientId: second.body.id, startTime, durationMinutes: 60, resourceIds: [resource.body.id] })).status).toBe(409);
    expect((await call("post", "/appointments", { clientId: second.body.id, startTime: "2027-02-12T15:00:00Z", resourceIds: ["foreign-resource"] })).status).toBe(409);
  });
  it("keeps clinical content encrypted and requires physician sign-off", async () => {
    const result = await call("post", "/charts", { clientId, kind: "CLINICAL_NOTE", content: { encounterDate: "2026-10-29", note: "Sensitive test chart content" } }, clinician);
    expect(result.status).toBe(201); chartId = result.body.id;
    const stored = await db.compassionChart.findUniqueOrThrow({ where: { id: chartId } });
    expect(stored.encryptedContent).not.toContain("Sensitive test chart content");
    expect((await call("post", `/charts/${chartId}/submit`, undefined, clinician)).status).toBe(200);
    expect((await call("patch", `/charts/${chartId}`, { content: { note: "changed" } }, clinician)).status).toBe(400);
    expect((await call("post", `/charts/${chartId}/sign`, { attest: true }, admin)).status).toBe(403);
    expect((await call("post", `/charts/${chartId}/sign`, { attest: true }, physician)).status).toBe(200);
    expect((await call("get", `/charts/${chartId}/report`, undefined, physician)).body.content.note).toBe("Sensitive test chart content");
    expect((await call("post", "/charts", { clientId, kind: "CLINICAL_NOTE", previousId: chartId, content: { encounterDate: "2026-10-29", note: "Amended", amendmentReason: "Correction" } }, clinician)).status).toBe(201);
    expect((await db.compassionChart.findUniqueOrThrow({ where: { id: chartId } })).status).toBe("SIGNED");
  });
  it("reports unsupported import fields and commits approved previews idempotently", async () => {
    const malformed = await call("post", "/migration/preview", { records: [{ externalSourceId: 42, firstName: "Test", lastName: "Client" }] });
    expect(malformed.status).toBe(200); expect(malformed.body.rejected).toBe(1);
    const unsupported = await call("post", "/migration/preview", { records: [{ externalSourceId: "bad", firstName: "A", lastName: "B", medicalField: "not mapped" }] });
    expect(unsupported.body.rejected).toBe(1);
    expect((await call("post", `/migration/${unsupported.body.id}/commit`, { approve: true, checksum: unsupported.body.checksum })).status).toBe(400);
    const body = { records: [{ externalSourceId: "cp-123", firstName: "Imported", lastName: "Client", intakeDate: "2020-01-02" }] };
    const preview = await call("post", "/migration/preview", body); expect(preview.body.created).toBe(1);
    const path = `/migration/${preview.body.id}/commit`; const approve = { approve: true, checksum: preview.body.checksum };
    expect((await call("post", path, approve)).body.created).toBe(1);
    expect((await call("post", path, approve)).body.created).toBe(1);
    expect(await db.compassionClient.count({ where: { organizationId: orgId, externalSourceId: "cp-123" } })).toBe(1);
    const repeated = await call("post", "/migration/preview", body); expect(repeated.body.updated).toBe(1);
  });
  it("preserves unmapped fields and rejects imports after concurrent client edits", async () => {
    const imported = await db.compassionClient.findFirstOrThrow({ where: { organizationId: orgId, externalSourceId: "cp-123" } });
    await call("put", `/clients/${imported.id}`, { phone: "555-0123", privateNotes: "Preserve casework context" });
    const records = [{ externalSourceId: "cp-123", firstName: "Imported", lastName: "Client" }];
    const preview = await call("post", "/migration/preview", { records });
    expect((await call("post", `/migration/${preview.body.id}/commit`, { approve: true, checksum: preview.body.checksum })).status).toBe(200);
    const preserved = await db.compassionClient.findUniqueOrThrow({ where: { id: imported.id } });
    expect(preserved.phone).toBe("555-0123"); expect(preserved.privateNotes).toBe("Preserve casework context");
    const stale = await call("post", "/migration/preview", { records });
    await call("put", `/clients/${imported.id}`, { phone: "555-0199" });
    expect((await call("post", `/migration/${stale.body.id}/commit`, { approve: true, checksum: stale.body.checksum })).status).toBe(400);
  });
  it("requires reviewed intake before creating a consent chart", async () => {
    const created = await call("post", "/intake", { clientId, language: "es", consentText: "Test consent wording reviewed by this test center." }); expect(created.status).toBe(201);
    const secret = created.body.path.split("/").pop();
    expect((await request(app).get(`/api/compassion-public/intake/${secret}`)).body.language).toBe("es");
    const submission = { consent: true, signedName: "Test Client", answers: { reason: "Test visit" } };
    expect((await request(app).post(`/api/compassion-public/intake/${secret}`).send(submission)).status).toBe(200);
    expect((await request(app).post(`/api/compassion-public/intake/${secret}`).send(submission)).status).toBe(400);
    expect((await call("post", `/intake/${created.body.id}/process`, { approve: true }, clinician)).status).toBe(200);
    expect((await call("post", `/intake/${created.body.id}/process`, { approve: true }, clinician)).status).toBe(400);
  });
  it("shares only explicitly shared documents and revokes old portal links", async () => {
    const document = await call("post", "/documents", { clientId, name: "test.pdf", mimeType: "application/pdf", base64: Buffer.from("%PDF-1.4\nTest fixture").toString("base64"), historical: true }, clinician); expect(document.status).toBe(201);
    const link = await call("post", `/clients/${clientId}/portal-access`); const secret = link.body.path.split("/").pop();
    expect((await request(app).get(`/api/compassion-public/portal/${secret}`)).body.documents).toHaveLength(0);
    expect((await call("patch", `/documents/${document.body.id}`, { shared: true }, clinician)).status).toBe(200);
    expect((await request(app).get(`/api/compassion-public/portal/${secret}`)).body.documents).toHaveLength(1);
    expect((await call("post", `/clients/${clientId}/portal-access`)).status).toBe(200);
    expect((await request(app).get(`/api/compassion-public/portal/${secret}`)).status).toBe(401);
  });
  it("enforces class capacity and grants completion points only once", async () => {
    const session = await call("post", "/classes", { title: "Test education", startTime: "2027-02-15T15:00:00Z", capacity: 1, points: 10 }); expect(session.status).toBe(201);
    const enrolled = await call("post", `/classes/${session.body.id}/enrollments`, { clientId });
    expect(enrolled.body.status).toBe("ENROLLED");
    expect((await call("patch", `/enrollments/${enrolled.body.id}`, { status: "COMPLETED" })).status).toBe(200);
    expect((await call("patch", `/enrollments/${enrolled.body.id}`, { status: "COMPLETED" })).status).toBe(200);
    expect((await call("get", `/clients/${clientId}/points`)).body.balance).toBe(10);
    expect((await call("post", `/clients/${clientId}/points`, { amount: -11, reason: "Test redemption", approve: true })).status).toBe(400);
    expect((await call("post", `/clients/${clientId}/points`, { amount: -5, reason: "Test redemption", approve: true })).status).toBe(201);
  });
  it("books public requests atomically without matching them to confidential charts", async () => {
    const token = `public_${suffix}`; const day = new Date(Date.now() + 5 * 86400000); day.setHours(0, 0, 0, 0);
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const configured = await call("put", "/appointment-widget", { enabled: true, config: { token, enabled: true, locationOptions: ["Test clinic"], minLeadHours: 0, maxAdvanceDays: 90, appointmentDurationMinutes: 30, slotIntervalMinutes: 30, availabilityBlocks: [{ id: "test", dayOfWeek: day.getDay(), startTime: "09:00", endTime: "12:00", location: "Test clinic", appointmentType: "ANY", capacity: 1, isActive: true }] } });
    expect(configured.status).toBe(200);
    const slots = await request(app).get(`/api/compassion-public/widget/${token}/slots?date=${dateKey}`);
    expect(slots.status).toBe(200); expect(slots.body.slots.length).toBeGreaterThan(0);
    const body = { firstName: "Public", lastName: "Request", email: "test-public@example.invalid", phone: "555-0199", location: "Test clinic", appointmentType: "INTAKE", startTime: slots.body.slots[0].startTime };
    const responses = await Promise.all([request(app).post(`/api/compassion-public/widget/${token}/appointments`).send(body), request(app).post(`/api/compassion-public/widget/${token}/appointments`).send(body)]);
    expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(responses.find((row) => row.status === 201)?.body.appointmentId).toBeUndefined();
    expect(await db.compassionClient.count({ where: { organizationId: orgId, clientStatus: "PENDING" } })).toBe(1);
    expect(await db.pluginSetting.count({ where: { organizationId: orgId } })).toBe(0);
  });
  it("preserves signed history and old links after a reviewed client merge", async () => {
    const target = await call("post", "/clients", { firstName: "Kept", lastName: "Identity" });
    const preview = await call("get", `/merge/preview?sourceId=${clientId}&targetId=${target.body.id}`); expect(preview.status).toBe(200);
    const merged = await call("post", "/merge/commit", { sourceId: clientId, targetId: target.body.id, checksum: preview.body.checksum, approve: true }); expect(merged.status).toBe(200);
    const old = await call("get", `/clients/${clientId}`); expect(old.status).toBe(307); expect(old.headers.location).toContain(target.body.id);
    expect((await call("get", `/charts/${chartId}/report`, undefined, physician)).body.client.firstName).toBe("Test");
    expect((await db.compassionChart.findUniqueOrThrow({ where: { id: chartId } })).clientId).toBe(target.body.id);
    clientId = target.body.id;
  });
  it("prepares client letters with only supported merge fields", async () => {
    const template = await call("post", "/letter-templates", { title: "Client follow-up", body: "Hello {{firstName}},\nPlease contact your care team." }); expect(template.status).toBe(201);
    const letter = await call("post", "/letters/preview", { clientId, templateId: template.body.id }); expect(letter.status).toBe(200); expect(letter.body.body).toContain("Hello Kept");
    expect((await call("post", "/letter-templates", { title: "Invalid", body: "{{donationAmount}}" })).status).toBe(400);
  });
  it("keeps client-care audit evidence out of the donor audit sink", async () => {
    const entries = await db.compassionAudit.findMany({ where: { organizationId: orgId } }); expect(entries.length).toBeGreaterThan(10);
    expect(JSON.stringify(entries)).not.toContain("Sensitive test chart content");
    expect(await db.auditLog.count({ where: { organizationId: orgId } })).toBe(0);
    expect(await db.constituent.count({ where: { organizationId: orgId } })).toBe(0);
    expect(await db.donation.count({ where: { constituent: { organizationId: orgId } } })).toBe(0);
  });
});
