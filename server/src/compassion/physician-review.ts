import { Router } from "express";
import { atomic, prisma } from "./database.js";
import { audit, digest, org, unseal } from "./security.js";
import { CareError, check } from "./http.js";
import { attachmentManifest, reviewChart, signedChartDigest } from "./clinical-review.js";
import { authenticateReviewer, clearReviewer, freshReviewerMfa, reviewerAuthRoutes, reviewerMiddleware, reviewerSafe, touchReviewer } from "./reviewer-auth.js";

export const physicianReviewRoutes = Router();
const router = physicianReviewRoutes;
router.use(reviewerAuthRoutes);
router.use(reviewerMiddleware);
async function exam(req: import("express").Request, id: string) {
  const row = await prisma.compassionChart.findFirst({ where: { id, organizationId: org(req), kind: "ULTRASOUND", OR: [{ status: "REVIEW" }, { status: "SIGNED", signedById: req.user!.sub }] } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Submitted examination not found.");
  if (row.status === "SIGNED") {
    const content = unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`);
    check(row.signedById && row.signedAt && row.signatureDigest === signedChartDigest({id:row.id,version:row.version,content,signer:row.signedById,signedAt:row.signedAt.toISOString()}), "Signed examination integrity verification failed.");
  }
  return row;
}
router.get("/session", reviewerSafe(async (req, res) => {
  res.json({ user: res.locals.reviewerUser, csrf: res.locals.reviewerCsrf, expiresAt: res.locals.reviewerSession.expiresAt });
}));
router.post("/activity", reviewerSafe(async (_req,res)=>{ await touchReviewer(res); res.json({active:true}); }));
router.post("/logout", reviewerSafe(async (req, res) => {
  await prisma.compassionReviewerSession.update({ where: { id: res.locals.reviewerSession.id }, data: { revokedAt: new Date() } });
  await audit(req, "REVIEWER_SIGNED_OUT", req.user!.sub); clearReviewer(res); res.json({ signedOut: true });
}));
router.get("/ultrasounds", reviewerSafe(async (req, res) => {
  const completed = req.query.completed === "true";
  const page = Number(req.query.page || 1); check(Number.isSafeInteger(page) && page >= 1, "Choose a valid page.");
  if (completed) {
    const where = { organizationId: org(req), actorId: req.user!.sub, action: { in: ["CHART_SIGNED", "CHART_RETURNED_FOR_CORRECTION"] } };
    const [events, total] = await Promise.all([
      prisma.compassionAudit.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 25, take: 25 }),
      prisma.compassionAudit.count({ where }),
    ]);
    const rows = await prisma.compassionChart.findMany({
      where: { organizationId: org(req), kind: "ULTRASOUND", id: { in: events.flatMap(event => event.entityId ? [event.entityId] : []) } },
      select: { id: true, clientId: true, version: true, status: true, signedById: true },
    });
    const patients = await prisma.compassionClient.findMany({ where: { organizationId: org(req), id: { in: rows.map(row => row.clientId) } }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true } });
    const items = events.flatMap(event => {
      const row = rows.find(candidate => candidate.id === event.entityId);
      if (!row) return [];
      const returned = event.action === "CHART_RETURNED_FOR_CORRECTION";
      if (!returned && (row.status !== "SIGNED" || row.signedById !== req.user!.sub)) return [];
      const metadata = event.metadata as { version?: number } | null;
      return [{ id: returned ? event.id : row.id, status: returned ? "RETURNED" : "SIGNED", version: metadata?.version ?? row.version, createdAt: event.createdAt, patient: patients.find(patient => patient.id === row.clientId) }];
    });
    await audit(req, "REVIEWER_HISTORY_READ"); await touchReviewer(res);
    res.json({ items, total, page }); return;
  }
  const where = { organizationId: org(req), kind: "ULTRASOUND", status: "REVIEW" };
  const [rows, total] = await Promise.all([prisma.compassionChart.findMany({ where, select: { id: true, clientId: true, version: true, createdAt: true, signedAt: true, status: true }, orderBy: { createdAt: "asc" }, skip: (page - 1) * 25, take: 25 }), prisma.compassionChart.count({ where })]);
  const patients = await prisma.compassionClient.findMany({ where: { organizationId: org(req), id: { in: rows.map(row => row.clientId) } }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true } });
  await audit(req, "REVIEWER_QUEUE_READ"); await touchReviewer(res);
  res.json({ items: rows.map(row => ({ ...row, patient: patients.find(p => p.id === row.clientId) })), total, page });
}));
router.get("/ultrasounds/:id", reviewerSafe(async (req, res) => {
  const row = await exam(req, String(req.params.id));
  const patient = await prisma.compassionClient.findFirst({ where: { organizationId: org(req), id: row.clientId }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true } });
  const documents = await prisma.compassionDocument.findMany({ where: { organizationId: org(req), chartId: row.id, clientId: row.clientId, deletedAt: null }, select: { id: true, name: true, mimeType: true, size: true } });
  let previous: unknown = null;
  if (row.previousId) {
    const prior = await prisma.compassionChart.findFirst({ where: { id: row.previousId, organizationId: org(req), clientId: row.clientId, kind: "ULTRASOUND", status: "SIGNED" } });
    if (prior) {
      const priorContent = unseal(prior.encryptedContent, `${org(req)}:${row.clientId}:chart`);
      check(prior.signedById && prior.signedAt && prior.signatureDigest === signedChartDigest({id:prior.id,version:prior.version,content:priorContent,signer:prior.signedById,signedAt:prior.signedAt.toISOString()}), "Previous signed version integrity verification failed.");
      previous = { version: prior.version, signedAt: prior.signedAt, content: JSON.parse(unseal(prior.encryptedContent, `${org(req)}:${row.clientId}:chart`)) };
    }
  }
  await audit(req, "REVIEWER_EXAM_READ", row.id); await touchReviewer(res);
  const content = JSON.parse(unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`));
  res.json({ id: row.id, patient: row.status === "SIGNED" ? content._signoff?.patient ?? patient : patient, status: row.status, version: row.version, updatedAt: row.updatedAt, signedAt: row.signedAt, content, documents, attachmentDigest: digest(JSON.stringify(await attachmentManifest(org(req), row.clientId, row.id))), previous });
}));
router.get("/ultrasounds/:id/documents/:documentId", reviewerSafe(async (req, res) => {
  const chart = await exam(req, String(req.params.id));
  const doc = await prisma.compassionDocument.findFirst({ where: { id: String(req.params.documentId), organizationId: org(req), chartId: chart.id, clientId: chart.clientId, deletedAt: null } });
  if (!doc) throw new CareError(404, "NOT_FOUND", "Supporting file not found.");
  const bytes = Buffer.from(unseal(doc.encryptedContent, `${org(req)}:${chart.clientId}:document`), "base64");
  check(digest(bytes) === doc.checksum, "Supporting file integrity verification failed.");
  await audit(req, "REVIEWER_SCAN_VIEWED", doc.id); await touchReviewer(res);
  res.setHeader("Content-Type", doc.mimeType); res.setHeader("Content-Disposition", "inline"); res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.send(bytes);
}));
for (const action of ["sign", "return"] as const) router.post(`/ultrasounds/:id/${action}`, reviewerSafe(async (req, res) => {
  if (action === "sign") {
    const fresh = await atomic(org(req), async () => { await authenticateReviewer(req,res); return freshReviewerMfa(req,res); });
    if (!fresh && res.locals.reviewerSession.mfaFailures >= 4) throw new CareError(401,"REVIEW_SESSION_REVOKED","Your physician session was revoked after repeated verification failures. Sign in again.");
    if (!fresh) throw new CareError(401, "FRESH_MFA_REQUIRED", "Enter a fresh authenticator code to sign this examination.");
  }
  const result = await atomic(org(req), async () => {
    // Re-read session and membership after acquiring the same write lock used by administration.
    await authenticateReviewer(req, res);

    const value = await reviewChart(req, String(req.params.id), action, true);
    await touchReviewer(res); return value;
  });
  if (result) res.json(result);
}));
