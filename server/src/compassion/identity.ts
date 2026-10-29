import { Router, type Request } from "express";
import { prisma } from "./database.js";
import { audit, digest, org, seal, unseal } from "./security.js";
import { check, client, route, text } from "./http.js";

export const identityRoutes = Router();
async function preview(req: Request, sourceId: string, targetId: string) {
  check(sourceId !== targetId, "Choose two different clients.");
  const source = await client(req, sourceId); const target = await client(req, targetId);
  check(!await prisma.compassionClientRedirect.findFirst({ where: { organizationId: org(req), sourceId: { in: [sourceId, targetId] } } }), "Choose current client records; these records have already been merged.");
  const where = { organizationId: org(req), clientId: sourceId };
  const counts = { cases: await prisma.compassionCase.count({ where }), appointments: await prisma.compassionAppointment.count({ where }), charts: await prisma.compassionChart.count({ where }), documents: await prisma.compassionDocument.count({ where }), services: await prisma.compassionService.count({ where }), followUps: await prisma.compassionFollowUp.count({ where }) };
  const checksum = digest(JSON.stringify({ sourceId, targetId, sourceUpdated: source.updatedAt, targetUpdated: target.updatedAt, counts }));
  return { source: { id: source.id, name: `${source.firstName} ${source.lastName}`, email: source.email, phone: source.phone, birthDate: source.dateOfBirth }, target: { id: target.id, name: `${target.firstName} ${target.lastName}`, email: target.email, phone: target.phone, birthDate: target.dateOfBirth }, counts, checksum };
}
identityRoutes.get("/merge/preview", ...route("manage", async (req, res) => {
  res.json(await preview(req, text(req.query.sourceId, 191), text(req.query.targetId, 191)));
}));
identityRoutes.post("/merge/commit", ...route("manage", async (req, res) => {
  const sourceId = text(req.body.sourceId, 191); const targetId = text(req.body.targetId, 191);
  const plan = await preview(req, sourceId, targetId);
  check(req.body.approve === true && req.body.checksum === plan.checksum, "Review and approve an unchanged merge preview.");
  const scope = { organizationId: org(req), clientId: sourceId };
  // Preserve every signed version while rebinding encrypted storage to the kept client.
  for (const row of await prisma.compassionChart.findMany({ where: scope })) {
    const content = unseal(row.encryptedContent, `${org(req)}:${sourceId}:chart`);
    await prisma.compassionChart.update({ where: { id: row.id }, data: { clientId: targetId, encryptedContent: seal(content, `${org(req)}:${targetId}:chart`) } });
  }
  for (const row of await prisma.compassionDocument.findMany({ where: scope })) {
    const content = unseal(row.encryptedContent, `${org(req)}:${sourceId}:document`);
    await prisma.compassionDocument.update({ where: { id: row.id }, data: { clientId: targetId, encryptedContent: seal(content, `${org(req)}:${targetId}:document`) } });
  }
  for (const row of await prisma.compassionMessage.findMany({ where: scope })) await prisma.compassionMessage.update({ where: { id: row.id }, data: { clientId: targetId, encryptedContent: seal(unseal(row.encryptedContent, `${org(req)}:${sourceId}:message`), `${org(req)}:${targetId}:message`) } });
  for (const row of await prisma.compassionIntake.findMany({ where: scope })) await prisma.compassionIntake.update({ where: { id: row.id }, data: { clientId: targetId, expiresAt: new Date(), ...(row.encryptedSubmission ? { encryptedSubmission: seal(unseal(row.encryptedSubmission, `${org(req)}:${sourceId}:intake`), `${org(req)}:${targetId}:intake`) } : {}) } });
  // Prevent duplicate enrollment/point awards from appearing as two active class memberships.
  for (const row of await prisma.compassionEnrollment.findMany({ where: scope })) {
    check(!await prisma.compassionEnrollment.findUnique({ where: { classId_clientId: { classId: row.classId, clientId: targetId } } }), "Both clients have enrollment in the same class. Reconcile it before merging.");
    await prisma.compassionEnrollment.update({ where: { id: row.id }, data: { clientId: targetId } });
  }
  await prisma.compassionCase.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionAppointment.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionService.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionFollowUp.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionActivity.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionPointEntry.updateMany({ where: scope, data: { clientId: targetId } });
  await prisma.compassionPortalAccess.updateMany({ where: { organizationId: org(req), clientId: { in: [sourceId, targetId] } }, data: { revokedAt: new Date() } });
  const source = await client(req, sourceId);
  if (source.privateNotes) await prisma.compassionActivity.create({ data: { organizationId: org(req), clientId: targetId, activityType: "CLIENT_NOTE", description: source.privateNotes, performedById: req.user!.sub, metadata: { mergeSourceId: sourceId } } });
  await prisma.compassionClient.update({ where: { id: sourceId }, data: { clientStatus: "ARCHIVED" } });
  await prisma.compassionClientRedirect.create({ data: { organizationId: org(req), sourceId, targetId, actorId: req.user!.sub } });
  await audit(req, "CLIENTS_MERGED", targetId, { sourceId }); res.json({ targetId, preservedSourceId: sourceId });
}));
