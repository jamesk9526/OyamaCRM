import { Router } from "express";
import { prisma } from "./database.js";
import { audit, digest, org, seal, unseal } from "./security.js";
import { CareError, check, client, route, text } from "./http.js";

export const CHART_KINDS = ["PREGNANCY_TEST", "PREGNANCY_HISTORY", "ULTRASOUND", "STD_TEST", "CLINICAL_NOTE", "CONSENT"] as const;
export function mayEditChart(status: string, authorId: string, userId: string): boolean { return status === "DRAFT" && authorId === userId; }
export function signedChartDigest(input: { id: string; version: number; content: string; signer: string; signedAt: string }): string {
  return digest(JSON.stringify(input));
}
export const clinicalRoutes = Router();
const router = clinicalRoutes;

router.get("/charts", ...route("clinical", async (req, res) => {
  const clientId = String(req.query.clientId ?? "");
  if (clientId) await client(req, clientId);
  const rows = await prisma.compassionChart.findMany({ where: { organizationId: org(req), ...(clientId ? { clientId } : { status: "REVIEW" }) }, orderBy: { createdAt: "desc" }, take: 250 });
  await audit(req, "CHART_LIST_READ", clientId || undefined);
  res.json(rows.map(({ encryptedContent, ...row }) => { void encryptedContent; return row; }));
}));
router.get("/charts/:id", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Chart not found.");
  await audit(req, "CHART_READ", row.id);
  const { encryptedContent, ...fields } = row;
  res.json({ ...fields, content: JSON.parse(unseal(encryptedContent, `${org(req)}:${row.clientId}:chart`)) });
}));
router.post("/charts", ...route("clinical", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  check(CHART_KINDS.includes(req.body.kind), "Choose a supported chart type.");
  check(req.body.content && typeof req.body.content === "object" && !Array.isArray(req.body.content), "Chart content must be an object.");
  const content = JSON.stringify(req.body.content); check(content.length <= 100000, "Chart is too large.");
  let version = 1;
  const previousId = req.body.previousId ? text(req.body.previousId, 191) : null;
  if (previousId) {
    const previous = await prisma.compassionChart.findFirst({ where: { id: previousId, organizationId: org(req), clientId, status: "SIGNED" } });
    check(previous && previous.kind === req.body.kind, "Amendments must reference a signed chart of the same type.");
    check(!await prisma.compassionChart.findFirst({ where: { organizationId: org(req), previousId } }), "An amendment already exists; use the latest version.");
    check(typeof req.body.content.amendmentReason === "string" && req.body.content.amendmentReason.trim(), "Record the reason for amendment.");
    version = previous.version + 1;
  }
  const row = await prisma.compassionChart.create({ data: { organizationId: org(req), clientId, kind: req.body.kind, version, previousId, authorId: req.user!.sub, encryptedContent: seal(content, `${org(req)}:${clientId}:chart`) } });
  await audit(req, previousId ? "CHART_AMENDMENT_CREATED" : "CHART_CREATED", row.id);
  res.status(201).json({ id: row.id });
}));
router.patch("/charts/:id", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  check(row && mayEditChart(row.status, row.authorId, req.user!.sub), "Only the author may edit a draft. Signed records require an amendment.");
  check(req.body.content && typeof req.body.content === "object" && !Array.isArray(req.body.content), "Chart content must be an object.");
  const content = JSON.stringify(req.body.content); check(content.length <= 100000, "Chart is too large.");
  await prisma.compassionChart.update({ where: { id: row.id }, data: { encryptedContent: seal(content, `${org(req)}:${row.clientId}:chart`) } });
  await audit(req, "CHART_DRAFT_UPDATED", row.id); res.json({ id: row.id });
}));
router.post("/charts/:id/submit", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  check(row && mayEditChart(row.status, row.authorId, req.user!.sub), "Only the author can submit a draft.");
  const content = JSON.parse(unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`));
  const required: Record<string, string[]> = { PREGNANCY_TEST: ["testDate", "method", "result", "clinicalNotes"], PREGNANCY_HISTORY: ["historyDate", "pregnancyHistory", "clinicalNotes"], ULTRASOUND: ["examDate", "indication", "findings", "impression", "followUp"], STD_TEST: ["specimenDate", "testName", "result", "clinicalNotes"], CLINICAL_NOTE: ["encounterDate", "note"], CONSENT: content.sourceIntakeId ? ["consentVersion"] : ["consentVersion", "consentText", "signedName", "signedDate"] };
  check((required[row.kind] ?? []).every((key) => typeof content[key] === "string" && content[key].trim()), "Complete all required chart fields before submitting.");
  check(!content._signoff, "Sign-off provenance is assigned only by the server.");
  if (row.kind === "ULTRASOUND") check(await prisma.compassionDocument.count({ where: { organizationId: org(req), chartId: row.id, clientId: row.clientId, deletedAt: null } }) > 0, "Attach ultrasound scans before review.");
  await prisma.compassionChart.update({ where: { id: row.id }, data: { status: "REVIEW" } });
  await audit(req, "CHART_SUBMITTED", row.id); res.json({ id: row.id, status: "REVIEW" });
}));
router.post("/charts/:id/sign", ...route("sign", async (req, res) => {
  const row = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  check(row?.status === "REVIEW", "Only charts awaiting review may be signed.");
  check(req.body.attest === true, "Confirm that you reviewed the chart and its attachments.");
  const signedAt = new Date();
  const original = unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`);
  const patient = await client(req, row.clientId);
  const attachments = await prisma.compassionDocument.findMany({ where: { chartId: row.id, clientId: row.clientId, organizationId: org(req), deletedAt: null }, select: { id: true, checksum: true } });
  const content = JSON.stringify({ ...JSON.parse(original), _signoff: { patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName, dateOfBirth: patient.dateOfBirth?.toISOString() ?? null }, attachments } });
  const signatureDigest = signedChartDigest({ id: row.id, version: row.version, content, signer: req.user!.sub, signedAt: signedAt.toISOString() });
  await prisma.compassionChart.update({ where: { id: row.id }, data: { encryptedContent: seal(content, `${org(req)}:${row.clientId}:chart`), status: "SIGNED", signedById: req.user!.sub, signedAt, signatureDigest } });
  await audit(req, "CHART_SIGNED", row.id); res.json({ id: row.id, status: "SIGNED", signatureDigest });
}));
router.get("/charts/:id/report", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionChart.findFirst({ where: { id: String(req.params.id), organizationId: org(req), status: "SIGNED" } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Signed report not found.");
  const content = JSON.parse(unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`));
  check(row.signedById && row.signedAt && row.signatureDigest === signedChartDigest({ id: row.id, version: row.version, content: JSON.stringify(content), signer: row.signedById, signedAt: row.signedAt.toISOString() }), "Report integrity verification failed.");
  await audit(req, "SIGNED_REPORT_EXPORTED", row.id);
  // Structured output is rendered by the client into a printable report; signature provenance is retained.
  res.json({ title: row.kind === "ULTRASOUND" ? "Limited Ultrasound Report" : "Signed Clinical Report", client: content._signoff.patient, version: row.version, templateVersion: row.templateVersion, content, signedById: row.signedById, signedAt: row.signedAt, signatureDigest: row.signatureDigest });
}));

router.get("/documents", ...route("clinical", async (req, res) => {
  const clientId = text(req.query.clientId, 191); await client(req, clientId);
  const rows = await prisma.compassionDocument.findMany({ where: { organizationId: org(req), clientId, deletedAt: null }, select: { id: true, clientId: true, chartId: true, name: true, mimeType: true, checksum: true, size: true, historical: true, shared: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  await audit(req, "DOCUMENT_LIST_READ", clientId); res.json(rows);
}));
router.post("/documents", ...route("clinical", async (req, res) => {
  const clientId = text(req.body.clientId, 191); await client(req, clientId);
  const name = text(req.body.name, 200); const mimeType = text(req.body.mimeType, 100);
  check(["application/pdf", "image/jpeg", "image/png", "video/mp4"].includes(mimeType), "Supported files: PDF, JPEG, PNG, and MP4.");
  const encoded = text(req.body.base64, 14000000); const bytes = Buffer.from(encoded, "base64");
  check(bytes.length > 0 && bytes.length <= 10000000 && bytes.toString("base64") === encoded, "Upload a valid file up to 10 MB.");
  const matches = mimeType === "application/pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : mimeType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(4, 8).toString() === "ftyp";
  check(matches, "File contents do not match the selected file type.");
  const chartId = req.body.chartId ? text(req.body.chartId, 191) : null;
  if (chartId) {
    const chart = await prisma.compassionChart.findFirst({ where: { id: chartId, organizationId: org(req), clientId, status: "DRAFT" } });
    check(chart, "Attachments may only be added to a draft chart for this client.");
  }
  const row = await prisma.compassionDocument.create({ data: { organizationId: org(req), clientId, chartId, name, mimeType, checksum: digest(bytes), size: bytes.length, historical: req.body.historical === true, uploadedById: req.user!.sub, encryptedContent: seal(encoded, `${org(req)}:${clientId}:document`) } });
  await audit(req, "DOCUMENT_UPLOADED", row.id); res.status(201).json({ id: row.id, checksum: row.checksum });
}));
router.get("/documents/:id/download", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionDocument.findFirst({ where: { id: String(req.params.id), organizationId: org(req), deletedAt: null } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Document not found.");
  await audit(req, "DOCUMENT_DOWNLOADED", row.id);
  res.json({ name: row.name, mimeType: row.mimeType, base64: unseal(row.encryptedContent, `${org(req)}:${row.clientId}:document`), checksum: row.checksum });
}));
router.patch("/documents/:id", ...route("clinical", async (req, res) => {
  const row = await prisma.compassionDocument.findFirst({ where: { id: String(req.params.id), organizationId: org(req) } });
  check(row, "Document not found.");
  if (row.chartId && req.body.deleted !== undefined) {
    const chart = await prisma.compassionChart.findFirst({ where: { id: row.chartId, organizationId: org(req) } });
    check(chart?.status === "DRAFT", "Attachments of reviewed or signed charts are protected.");
  }
  await prisma.compassionDocument.update({ where: { id: row.id }, data: { ...(typeof req.body.shared === "boolean" ? { shared: req.body.shared } : {}), ...(typeof req.body.deleted === "boolean" ? { deletedAt: req.body.deleted ? new Date() : null } : {}) } });
  await audit(req, "DOCUMENT_VISIBILITY_UPDATED", row.id); res.json({ id: row.id });
}));
