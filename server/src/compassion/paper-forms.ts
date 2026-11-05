import { Router, type Request } from "express";
import { prisma } from "./database.js";
import { audit, digest, hasCareCapability, org, seal, unseal } from "./security.js";
import { CareError, check, client, route, text } from "./http.js";
import { FORM_TEMPLATES, validateAnswers, answerIssues, contactPreferences, type Answers } from "./form-templates.js";

export const paperFormRoutes = Router();
const router = paperFormRoutes;
export async function careLinks(req: Request, clientId: string, caseId: unknown, visitId: unknown) {
  if (caseId) check(await prisma.compassionCase.findFirst({ where: { id: text(caseId, 191), organizationId: org(req), clientId } }), "Choose this client’s case.");
  if (visitId) {
    const visit = await prisma.compassionVisit.findFirst({ where: { id: text(visitId, 191), organizationId: org(req), clientId } });
    check(visit && (!caseId || visit.caseId === caseId), "Choose a visit belonging to this client and case.");
  }
}
const reveal = (row: { encryptedAnswers: string; clientId: string; [key: string]: unknown }, organizationId: string) => {
  const { encryptedAnswers, ...metadata } = row;
  return { ...metadata, answers: JSON.parse(unseal(encryptedAnswers, `${organizationId}:${row.clientId}:form`)) };
};
router.get("/form-templates", ...route("casework", async (_req, res) => {
  res.json(Object.entries(FORM_TEMPLATES).filter(([, t]) => t.capability !== "clinical" || hasCareCapability(res.locals.careRole, "clinical")).map(([kind, t]) => ({ kind, ...t })));
}));
router.get("/clients/:id/forms", ...route("casework", async (req, res) => {
  const patient = await client(req, String(req.params.id));
  const records = await prisma.compassionFormRecord.findMany({ where: { organizationId: org(req), clientId: patient.id }, select: { id: true, kind: true, status: true, version: true, templateVersion: true, caseId: true, visitId: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 250 });
  const charts = hasCareCapability(res.locals.careRole, "clinical") ? await prisma.compassionChart.findMany({ where: { organizationId: org(req), clientId: patient.id, kind: { in: Object.keys(FORM_TEMPLATES).filter(k => FORM_TEMPLATES[k].capability === "clinical") } }, select: { id: true, kind: true, status: true, version: true, templateVersion: true, caseId: true, visitId: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" }, take: 250 }) : [];
  await audit(req, "FORM_LIST_READ", patient.id);
  res.json([...records.map(r => ({ ...r, recordType: "casework" })), ...charts.map(r => ({ ...r, recordType: "chart" }))]);
}));
router.post("/case-forms", ...route("casework", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  const kind = text(req.body.kind, 50); const template = FORM_TEMPLATES[kind];
  check(template?.capability === "casework", "Use the protected chart workflow for clinical forms.");
  check(validateAnswers(kind, req.body.answers).length === 0, "Invalid form answers. Check field types and choices.");
  await careLinks(req, clientId, req.body.caseId, req.body.visitId);
  const row = await prisma.compassionFormRecord.create({ data: { organizationId: org(req), clientId, caseId: req.body.caseId || null, visitId: req.body.visitId || null, kind, templateVersion: template.version, sourceDigest: template.sourceSha256 ?? digest(JSON.stringify(template)), encryptedAnswers: seal(JSON.stringify(req.body.answers), `${org(req)}:${clientId}:form`), authorId: req.user!.sub } });
  await audit(req, "CASE_FORM_CREATED", row.id); res.status(201).json(reveal(row, org(req)));
}));
router.get("/case-forms/:id", ...route("casework", async (req, res) => {
  const row = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Form not found.");
  await audit(req, "CASE_FORM_READ", row.id); res.json(reveal(row, org(req)));
}));
router.patch("/case-forms/:id", ...route("casework", async (req, res) => {
  const row = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Form not found.");
  if (req.body.expectedVersion !== row.version) throw new CareError(409, "FORM_CHANGED", "This form changed. Reload before saving; your edits have been retained.");
  check(validateAnswers(row.kind, req.body.answers).length === 0, "Invalid form answers. Check field types and choices.");
  check(["DRAFT", "COMPLETE"].includes(req.body.status ?? "DRAFT"), "Choose a valid form status.");
  check(req.body.status !== "COMPLETE" || answerIssues(row.kind, req.body.answers).length === 0, "Review contradictory paper answers before completing this form.");
  await prisma.compassionFormRevision.create({ data: { organizationId: org(req), formId: row.id, version: row.version, encryptedAnswers: row.encryptedAnswers, actorId: req.user!.sub } });
  const updated = await prisma.compassionFormRecord.update({ where: { id: row.id }, data: { encryptedAnswers: seal(JSON.stringify(req.body.answers), `${org(req)}:${row.clientId}:form`), version: row.version + 1, status: req.body.status ?? "DRAFT" } });
  await audit(req, "CASE_FORM_REVISED", row.id); res.json(reveal(updated, org(req)));
}));
router.get("/case-forms/:id/revisions", ...route("casework", async (req, res) => {
  const row = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Form not found.");
  const revisions = await prisma.compassionFormRevision.findMany({ where: { organizationId: org(req), formId: row.id }, orderBy: { version: "desc" } });
  await audit(req, "CASE_FORM_HISTORY_READ", row.id);
  res.json(revisions.map(r => ({ id: r.id, version: r.version, actorId: r.actorId, createdAt: r.createdAt, answers: JSON.parse(unseal(r.encryptedAnswers, `${org(req)}:${row.clientId}:form`)) })));
}));
router.post("/case-forms/:id/apply-profile", ...route("casework", async (req, res) => {
  const row = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req), kind: "CASE_INTAKE" } });
  check(row && req.body.approve === true && req.body.expectedVersion === row.version, "Review the current intake version and approve the profile update.");
  const answers: Answers = JSON.parse(unseal(row.encryptedAnswers, `${org(req)}:${row.clientId}:form`));
  check(!answerIssues(row.kind, answers).length, "Resolve conflicting selections before applying contact preferences.");
  const fields: Record<string, string> = { firstName: "firstName", lastName: "lastName", phone: "phone", email: "email", mailingAddress: "addressLine1", city: "city", state: "state", zip: "zip", referralSource: "referralSource" };
  const data: Record<string, string | Date | ReturnType<typeof contactPreferences>> = { safeContact: contactPreferences(answers) };
  for (const [source, target] of Object.entries(fields)) if (typeof answers[source] === "string" && answers[source].trim()) { check(answers[source].length <= 191, "Profile fields must be 191 characters or fewer."); data[target] = answers[source].trim(); }
  if (typeof answers.dateOfBirth === "string" && answers.dateOfBirth) data.dateOfBirth = new Date(answers.dateOfBirth);
  await client(req, row.clientId); await prisma.compassionClient.update({ where: { id: row.clientId }, data });
  await audit(req, "INTAKE_PROFILE_APPLIED", row.id); res.json({ updated: true });
}));
router.get("/case-forms/:id/documents", ...route("casework", async (req, res) => {
  const form = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(form, "Form not found.");
  const rows = await prisma.compassionDocument.findMany({ where: { organizationId: org(req), clientId: form.clientId, formId: form.id, accessScope: "CASEWORK", deletedAt: null }, select: { id: true, name: true, mimeType: true, size: true, checksum: true, createdAt: true } });
  await audit(req, "FORM_ATTACHMENTS_READ", form.id); res.json(rows);
}));
router.post("/case-forms/:id/documents", ...route("casework", async (req, res) => {
  const form = await prisma.compassionFormRecord.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } }); check(form, "Form not found.");
  check(req.body.confirmCaseworkOnly === true, "Confirm this file contains no clinical information. Combined health documents require clinical storage.");
  const mimeType = text(req.body.mimeType, 100); const name = text(req.body.name, 200); const encoded = text(req.body.base64, 14000000); const bytes = Buffer.from(encoded, "base64");
  check(bytes.length > 0 && bytes.length <= 10000000 && bytes.toString("base64") === encoded, "Choose a valid file up to 10 MB.");
  check((mimeType === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-") || (mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (mimeType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255), "Choose a PDF, PNG, or JPEG matching its file type.");
  const row = await prisma.compassionDocument.create({ data: { organizationId: org(req), clientId: form.clientId, formId: form.id, accessScope: "CASEWORK", name, mimeType, checksum: digest(bytes), size: bytes.length, uploadedById: req.user!.sub, historical: true, encryptedContent: seal(encoded, `${org(req)}:${form.clientId}:document`) } });
  await audit(req, "FORM_SOURCE_UPLOADED", row.id); res.status(201).json({ id: row.id });
}));
router.get("/case-form-documents/:id/download", ...route("casework", async (req, res) => {
  const row = await prisma.compassionDocument.findFirst({ where: { id: String(req.params.id), organizationId: org(req), accessScope: "CASEWORK", deletedAt: null } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Casework attachment not found.");
  check(row.formId && await prisma.compassionFormRecord.findFirst({ where: { id: row.formId, organizationId: org(req), clientId: row.clientId } }), "Attachment owner not found.");
  await audit(req, "FORM_SOURCE_DOWNLOADED", row.id); res.json({ name: row.name, mimeType: row.mimeType, base64: unseal(row.encryptedContent, `${org(req)}:${row.clientId}:document`), checksum: row.checksum });
}));
