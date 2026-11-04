import { Router, type Request, type Response, type NextFunction } from "express";
import { invalidateLegacyBindings } from "../oyama-create/legacy-invalidation.js";
import { assertCurrentCreateArtifact, recordCreatePrintStatus } from "../oyama-create/print-adapter.js";
import { LetterCategory, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { buildProductionSnapshot, cleanDocumentBody, combineArtifacts, digest, enqueueSnapshot, json, productionEnabled, ProductionError, readArtifact, validateCurrentRecipient } from "../services/letter-production.js";
import { record, string, type LetterSnapshot } from "../services/letter-production-contract.js";
import { generateLetterFromTemplate, resolveLetterMergeContext } from "../services/letters-execution.js";
import { renderAvery5160Pdf } from "../services/avery-labels.js";

import {assertStudioArtifactAccess} from "../oyama-create/studio/print-access.js";
const router = Router();
const id = (req: Request, key = "id") => string(req.params[key]);
const route = (handler: (req: Request, res: Response, organizationId: string, actorId: string) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId || !req.user?.sub) throw new ProductionError(403, "Organization access is required.");
    if (req.path !== "/config" && !(await productionEnabled(organizationId))) throw new ProductionError(409, "The new letter production workspace is not enabled for this organization.");
    await handler(req, res, organizationId, req.user.sub);
  } catch (error) {
    if (error instanceof ProductionError) { res.status(error.status).json({ error: { code: "LETTER_PRODUCTION", message: error.message } }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: { code: "CONFLICT", message: "This operation already exists. Refresh before retrying." } }); return; }
    next(error);
  }
};
const publicJob = (job: { id: string; status: string; error: string | null; checksum: string | null; pageCount: number | null; fingerprint: string; rendererVersion: string; snapshotJson: unknown; warningsJson: unknown; generatedLetterId: string | null; attempts: number }) => {
  const snapshot = job.snapshotJson as LetterSnapshot;
  return { id: job.id, status: job.status, error: job.error, checksum: job.checksum, pageCount: job.pageCount, fingerprint: job.fingerprint, rendererVersion: job.rendererVersion, revision: snapshot.revision, recipient: snapshot.recipient, recipientId: snapshot.recipientId, generatedLetterId: job.generatedLetterId, warnings: job.warningsJson ?? snapshot.warnings, blockers: snapshot.blockers, attempts: job.attempts };
};
const idsFrom = (raw: unknown, max = 500): string[] => {
  if (!Array.isArray(raw) || !raw.length || raw.length > max || raw.some(value => typeof value !== "string" || !/^[a-z0-9_-]{3,128}$/i.test(value))) throw new ProductionError(400, `Select 1–${max} valid items.`);
  return raw;
};

router.get("/config", requirePermission("letters.view"), route(async (_req, res, org) => { res.json({ enabled: await productionEnabled(org) }); }));
router.put("/config", requirePermission("letters.manage_branding"), route(async (req, res, org) => {
  if (typeof req.body?.enabled !== "boolean") throw new ProductionError(400, "enabled must be true or false.");
  await prisma.pluginSetting.upsert({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: "letters-production-v2" } }, create: { organizationId: org, pluginKey: "letters-production-v2", config: { enabled: req.body.enabled } }, update: { config: { enabled: req.body.enabled } } });
  res.json({ enabled: req.body.enabled });
}));

function documentData(body: Record<string, unknown>) {
  if (!string(body.name).trim() || !string(body.printBody).trim()) throw new ProductionError(400, "Name and letter content are required.");
  if (string(body.printBody).length > 500_000 || JSON.stringify(body.documentJson ?? {}).length > 1_000_000) throw new ProductionError(400, "This document exceeds the editor size limit.");
  if (record(body.documentJson).type !== "doc") throw new ProductionError(400, "A structured editor document is required.");
  const category = string(body.category) || "GENERAL";
  if (!Object.values(LetterCategory).includes(category as LetterCategory)) throw new ProductionError(400, "Invalid category.");
  return { name: string(body.name).trim(), category: category as LetterCategory, printSubject: string(body.printSubject), printBody: cleanDocumentBody(string(body.printBody)), printLayoutJson: json(record(body.printLayoutJson)), documentJson: json(body.documentJson), documentSchemaVersion: 2 };
}
router.post("/templates", requirePermission("letters.create"), route(async (req, res, org, actor) => {
  const data = documentData(record(req.body));
  const saved = await prisma.$transaction(async tx => {
    const template = await tx.letterTemplate.create({ data: { ...data, organizationId: org, createdByUserId: actor, updatedByUserId: actor, revision: 1 } });
    await tx.letterDocumentRevision.create({ data: { organizationId: org, templateId: template.id, revision: template.revision, snapshotJson: json(template), createdBy: actor } });
    return template;
  });
  res.status(201).json(saved);
}));
router.patch("/templates/:id", requirePermission("letters.edit"), route(async (req, res, org, actor) => {
  const data = documentData(record(req.body));
  if (!Number.isInteger(req.body?.revision) || req.body.revision < 0) throw new ProductionError(400, "The template revision is required.");
  const saved = await prisma.$transaction(async tx => {
    const original = await tx.letterTemplate.findFirst({ where: { id: id(req), organizationId: org, revision: req.body.revision } });
    if (original?.documentSchemaVersion === 1) {
      await tx.letterDocumentRevision.upsert({ where: { organizationId_templateId_revision: { organizationId: org, templateId: original.id, revision: original.revision } }, update: {}, create: { organizationId: org, templateId: original.id, revision: original.revision, snapshotJson: json(original), createdBy: actor } });
    }
    const changed = await tx.letterTemplate.updateMany({ where: { id: id(req), organizationId: org, revision: req.body.revision }, data: { ...data, revision: { increment: 1 }, updatedByUserId: actor } });
    if (!changed.count) throw new ProductionError(409, "This template changed in another session. Your draft is preserved; reload the saved version before retrying.");
    const template = await tx.letterTemplate.findFirstOrThrow({ where: { id: id(req), organizationId: org } });
    await tx.letterDocumentRevision.create({ data: { organizationId: org, templateId: template.id, revision: template.revision, snapshotJson: json(template), createdBy: actor } });
    return template;
  });
  await invalidateLegacyBindings(org, "LETTER", saved.id);
  res.json(saved);
}));
router.get("/templates/:id/revisions", requirePermission("letters.view"), route(async (req, res, org) => {
  const revisions = await prisma.letterDocumentRevision.findMany({ where: { organizationId: org, templateId: id(req) }, orderBy: { revision: "desc" }, take: 100, select: { id: true, revision: true, createdAt: true, createdBy: true } });
  res.json(revisions);
}));

router.post("/jobs", requirePermission("letters.generate"), route(async (req, res, org, actor) => {
  const template = await prisma.letterTemplate.findFirst({ where: { organizationId: org, id: string(req.body?.templateId), documentSchemaVersion: 2 } });
  if (!template) throw new ProductionError(404, "Save this template in the new editor before rendering.");
  if (template.revision !== req.body?.revision) throw new ProductionError(409, "The template changed. Save or reload before rendering.");
  const constituentId = string(req.body?.constituentId) || undefined;
  const merged = await resolveLetterMergeContext({ organizationId: org, template, constituentId, donationId: string(req.body?.donationId) || undefined, actorUserId: actor });
  const snapshot = await buildProductionSnapshot({ organizationId: org, templateId: template.id, bodyHtml: merged.mergedPrintBody, subject: merged.mergedPrintSubject || "", recipientId: constituentId,
    generatedAt: new Date(new Date().toISOString().slice(0, 10) + "T12:00:00Z"), blockers: [...merged.unsupportedFields.map(field => `Unsupported field: ${field}`), ...merged.missingFields.map(field => `Missing value: ${field}`)] });
  res.status(202).json(publicJob(await enqueueSnapshot(snapshot, actor)));
}));
router.get("/jobs/:id", requirePermission("letters.view"), route(async (req, res, org) => {
  const job = await prisma.letterRenderJob.findFirst({ where: { id: id(req), organizationId: org } });
  if (!job) throw new ProductionError(404, "Render job not found.");
  const approval = job.checksum ? await prisma.letterArtifactApproval.findUnique({ where: { organizationId_artifactId_checksum: { organizationId: org, artifactId: job.id, checksum: job.checksum } } }) : null;
  res.json({ ...publicJob(job), approved: !!approval });
}));
router.post("/jobs/:id/retry", requirePermission("letters.generate"), route(async (req, res, org) => {
  const result = await prisma.letterRenderJob.updateMany({ where: { id: id(req), organizationId: org, status: "FAILED" }, data: { status: "PENDING", attempts: 0, error: null, leaseToken: null, leaseUntil: null } });
  if (!result.count) throw new ProductionError(409, "Only failed jobs can be retried.");
  res.json({ status: "PENDING" });
}));
router.get("/artifacts/:id/pdf", requirePermission("letters.export_pdf"), route(async (req, res, org) => {
  await assertStudioArtifactAccess(req,org,id(req));
  const { job, bytes } = await readArtifact(org, id(req));
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="letter-${job.id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Letter-Checksum": job.checksum!, "X-Letter-Artifact": job.id });
  res.send(bytes);
}));
router.post("/artifacts/:id/approve", requirePermission("letters.manage_print_queue"), route(async (req, res, org, actor) => {
  await assertCurrentCreateArtifact(org, id(req));
  await assertStudioArtifactAccess(req,org,id(req));
  const { job } = await readArtifact(org, id(req));
  if (req.body?.checksum !== job.checksum) throw new ProductionError(409, "The reviewed PDF checksum does not match.");
  await validateCurrentRecipient(org, job.snapshotJson as unknown as LetterSnapshot);
  await prisma.letterArtifactApproval.upsert({ where: { organizationId_artifactId_checksum: { organizationId: org, artifactId: job.id, checksum: job.checksum! } }, create: { organizationId: org, artifactId: job.id, checksum: job.checksum!, approvedBy: actor }, update: {} });
  res.json({ approved: true, artifactId: job.id, checksum: job.checksum });
}));
router.post("/artifacts/:id/events", requirePermission("letters.manage_print_queue"), route(async (req, res, org, actor) => {
  await assertCurrentCreateArtifact(org, id(req));
  const { job } = await readArtifact(org, id(req));
  const kind = string(req.body?.kind);
  if (!["PRINT_REQUESTED", "PRINTED", "MAILED", "REPRINT_REQUESTED"].includes(kind)) throw new ProductionError(400, "Invalid production event.");
  if (kind === "MAILED") throw new ProductionError(400, "Confirm mailing through the authorized mail queue.");
  const approval = await prisma.letterArtifactApproval.findUnique({ where: { organizationId_artifactId_checksum: { organizationId: org, artifactId: job.id, checksum: job.checksum! } } });
  if (!approval) throw new ProductionError(409, "Approve this exact PDF before requesting print.");
  await validateCurrentRecipient(org, job.snapshotJson as unknown as LetterSnapshot);
  const reason = string(req.body?.reason).trim();
  const priorPrint = await prisma.letterProductionEvent.findFirst({ where: { organizationId: org, artifactId: job.id, kind: { in: ["PRINT_REQUESTED", "PRINTED", "REPRINT_REQUESTED"] } } });
  if (kind === "PRINT_REQUESTED" && priorPrint) throw new ProductionError(409, "This PDF already has a print request. Use reviewed reprint with a reason.");
  if (kind === "REPRINT_REQUESTED" && (!priorPrint || !reason)) throw new ProductionError(400, "A reprint requires an earlier print request and a reason.");
  if (kind === "PRINTED" && !priorPrint) throw new ProductionError(409, "Record a print request first.");
  await prisma.$transaction(async tx => {
    await tx.letterProductionEvent.create({ data: { organizationId: org, artifactId: job.id, kind, reason, actorId: actor } });
    if (kind === "PRINTED" && job.generatedLetterId) await tx.generatedLetter.updateMany({ where: { id: job.generatedLetterId, organizationId: org }, data: { printedAt: new Date(), status: "PRINTED" } });
  });
  await recordCreatePrintStatus(org, { artifactId: job.id }, kind === "PRINTED" ? "PRINTED" : "PRINT_REQUESTED");
  res.json({ recorded: true });
}));

router.post("/batches", requirePermission("letters.generate_batch"), route(async (req, res, org, actor) => {
  const letterIds = idsFrom(req.body?.letterIds, 10_000);
  if (new Set(letterIds).size !== letterIds.length) throw new ProductionError(400, "Select each generated letter once. Different letters for the same recipient remain separate.");
  const jobs = await prisma.letterRenderJob.findMany({ where: { organizationId: org, generatedLetterId: { in: letterIds } }, orderBy: { createdAt: "desc" } });
  const ordered = letterIds.map(letterId => jobs.find(job => job.generatedLetterId === letterId));
  if (ordered.some(job => !job)) throw new ProductionError(409, "Some letters do not have frozen production inputs. Regenerate those letters in the new workspace.");
  const manifestKey = digest(JSON.stringify(ordered.map(job => job!.id)));
  const existing = await prisma.letterProductionBatch.findUnique({ where: { organizationId_manifestKey: { organizationId: org, manifestKey } } });
  if (existing) { res.json(existing); return; }
  const batch = await prisma.$transaction(async tx => {
    const created = await tx.letterProductionBatch.create({ data: { organizationId: org, manifestKey, name: string(req.body?.name).trim() || "Prepared letters", createdBy: actor } });
    await tx.letterProductionBatchItem.createMany({ data: ordered.map((job, position) => ({ organizationId: org, batchId: created.id, position, generatedLetterId: job!.generatedLetterId!, artifactId: job!.id })) });
    return created;
  });
  res.status(201).json(batch);
}));
router.get("/batches", requirePermission("letters.view"), route(async (_req, res, org) => { res.json(await prisma.letterProductionBatch.findMany({ where: { organizationId: org }, orderBy: { createdAt: "desc" }, take: 100 })); }));
router.get("/batches/:id", requirePermission("letters.view"), route(async (req, res, org) => {
  const batch = await prisma.letterProductionBatch.findFirst({ where: { id: id(req), organizationId: org } });
  if (!batch) throw new ProductionError(404, "Batch not found.");
  const items = await prisma.letterProductionBatchItem.findMany({ where: { batchId: batch.id, organizationId: org }, orderBy: { position: "asc" } });
  const jobs = await prisma.letterRenderJob.findMany({ where: { organizationId: org, id: { in: items.map(item => item.artifactId) } } });
  const approvals = await prisma.letterArtifactApproval.findMany({ where: { organizationId: org, artifactId: { in: jobs.map(job => job.id) } } });
  let page = 1;
  const rows = items.map(item => {
    const job = jobs.find(job => job.id === item.artifactId);
    const start = page; page += job?.pageCount ?? 0;
    return { ...item, job: job ? publicJob(job) : null, approved: approvals.some(a => a.artifactId === job?.id && a.checksum === job.checksum), part: Math.floor(item.position / 500), labelPosition: item.position % 30 + 1, pageStart: job?.pageCount ? start : null, pageEnd: job?.pageCount ? page - 1 : null };
  });
  res.json({ ...batch, items: rows, counts: { included: rows.length, failed: jobs.filter(job => job.status === "FAILED").length, pending: jobs.filter(job => ["PENDING", "RENDERING"].includes(job.status)).length, reviewRequired: rows.filter(row => !row.approved).length } });
}));
router.post("/batches/:id/export", requirePermission("letters.export_pdf"), route(async (req, res, org) => {
  const part = req.body?.part;
  if (!Number.isInteger(part) || part < 0) throw new ProductionError(400, "Select a valid batch part.");
  const items = await prisma.letterProductionBatchItem.findMany({ where: { organizationId: org, batchId: id(req), position: { gte: part * 500, lt: (part + 1) * 500 } }, orderBy: { position: "asc" } });
  if (!items.length) throw new ProductionError(404, "Batch part not found.");
  for (const item of items) {await assertCurrentCreateArtifact(org, item.artifactId);await assertStudioArtifactAccess(req,org,item.artifactId);}
  if (req.body?.labels === true) {
    const labels = [];
    for (const item of items) {
      const { job } = await readArtifact(org, item.artifactId);
      const snapshot = job.snapshotJson as unknown as LetterSnapshot;
      await validateCurrentRecipient(org, snapshot);
      labels.push({ ...snapshot.recipient, name: snapshot.recipient.name });
    }
    const startPosition = Number(req.body?.startPosition ?? 1);
    if (!Number.isInteger(startPosition) || startPosition < 1 || startPosition > 30) throw new ProductionError(400, "First label must be between 1 and 30.");
    const bytes = await renderAvery5160Pdf(labels, { startPosition, showGuides: req.body?.showGuides === true });
    res.set({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Labels-Rendered": String(labels.length) }).send(bytes);
    return;
  }
  const combined = await combineArtifacts(org, items.map(item => item.artifactId));
  res.set({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Letter-Checksum": digest(combined.bytes) }).send(combined.bytes);
}));

export default router;
