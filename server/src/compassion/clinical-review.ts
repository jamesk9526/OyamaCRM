import type { Request } from "express";
import { atomic, prisma } from "./database.js";
import { audit, digest, org, seal, unseal } from "./security.js";
import { CareError, check, text } from "./http.js";

export const signedChartDigest = (input: { id: string; version: number; content: string; signer: string; signedAt: string }) => digest(JSON.stringify(input));
export async function attachmentManifest(organizationId: string, clientId: string, chartId: string) {
  const files = await prisma.compassionDocument.findMany({ where: { organizationId, clientId, chartId, deletedAt: null }, select: { id: true, checksum: true } });
  return files.sort((a,b) => a.id.localeCompare(b.id));
}
/** The same transaction and signature evidence serve both staff and the restricted portal. */
export async function reviewChart(req: Request, id: string, action: "sign" | "return", ultrasoundOnly = false) {
  return atomic(org(req), async () => {
    const membership = await prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId: org(req), userId: req.user!.sub } } });
    if (!membership?.active || membership.role !== (ultrasoundOnly ? "ULTRASOUND_REVIEWER" : "PHYSICIAN")) throw new CareError(403,"PHYSICIAN_REQUIRED","An active authorized physician is required for clinical sign-off or correction.");
    const row = await prisma.compassionChart.findFirst({ where: { id, organizationId: org(req) } });
    if (!row || (ultrasoundOnly && row.kind !== "ULTRASOUND")) throw new CareError(404, "NOT_FOUND", "Examination not found.");
    check(row.status === "REVIEW", "Only unsigned charts awaiting review may be signed or returned.");
    if (row.kind === "ULTRASOUND") check(typeof req.body.expectedUpdatedAt === "string", "Reload the examination and send its current version.");
    if (req.body.expectedUpdatedAt !== undefined && req.body.expectedUpdatedAt !== row.updatedAt.toISOString()) throw new CareError(409, "CHART_CHANGED", "This chart has changed. Reload it before continuing.");
    const original = unseal(row.encryptedContent, `${org(req)}:${row.clientId}:chart`);
    const content = JSON.parse(original);
    if (action === "return") {
      content._review = { reason: text(req.body.reason, 5000), reviewerId: req.user!.sub, returnedAt: new Date().toISOString() };
      await prisma.compassionChart.update({ where: { id }, data: { status: "DRAFT", encryptedContent: seal(JSON.stringify(content), `${org(req)}:${row.clientId}:chart`) } });
      await audit(req, "CHART_RETURNED_FOR_CORRECTION", id, { version: row.version });
      return { id, status: "DRAFT" };
    }
    check(req.body.attest === true, "Confirm that you reviewed the examination and its supporting files.");
    const attachments = await attachmentManifest(org(req), row.clientId, id);
    if (row.kind === "ULTRASOUND") check(attachments.length > 0, "Supporting ultrasound scans are required.");
    if (ultrasoundOnly || req.body.expectedAttachmentDigest !== undefined) {
      if (req.body.expectedAttachmentDigest !== digest(JSON.stringify(attachments))) throw new CareError(409, "ATTACHMENTS_CHANGED", "Supporting files changed. Reload and review them again.");
    }
    const patient = await prisma.compassionClient.findFirst({ where: { id: row.clientId, organizationId: org(req) }, select: { id: true, firstName: true, lastName: true, dateOfBirth: true } });
    const signer = await prisma.user.findFirst({ where: { id: req.user!.sub, organizationId: org(req), active: true }, select: { id: true, firstName: true, lastName: true } });
    check(patient && signer, "Patient and active signing physician are required.");
    const signedAt = new Date();
    const signedContent = JSON.stringify({ ...content, _signoff: { patient: { ...patient, dateOfBirth: patient.dateOfBirth?.toISOString() ?? null }, attachments, signer: { id: signer.id, name: `${signer.firstName} ${signer.lastName}`, role: membership.role }, attestation: "I reviewed this examination and all supporting scans and approve my electronic sign-off." } });
    const signatureDigest = signedChartDigest({ id, version: row.version, content: signedContent, signer: signer.id, signedAt: signedAt.toISOString() });
    await prisma.compassionChart.update({ where: { id }, data: { encryptedContent: seal(signedContent, `${org(req)}:${row.clientId}:chart`), status: "SIGNED", signedById: signer.id, signedAt, signatureDigest } });
    await audit(req, "CHART_SIGNED", id, { version: row.version });
    return { id, status: "SIGNED", signatureDigest };
  });
}
