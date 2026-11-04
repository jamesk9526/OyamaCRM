import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { assertCampaign, can, demand, demandChannels } from "./access.js";
import { route, param } from "./http.js";
import { CreateError, object, string, variantFrom, type Channel } from "./domain.js";
import { nativeRecord, parseStored, emailRecordAccessible, reusableEmailRecord } from "./legacy.js";
const router = Router();
router.get("/legacy", route(async (req, res, org, actor) => {
  const emails = await can(req, "view:communications") ? await prisma.emailCampaign.findMany({ where: { organizationId: org }, orderBy: { updatedAt: "desc" }, take: 100 }) : [];
  const letters = await can(req, "letters.view") ? await prisma.letterTemplate.findMany({ where: { organizationId: org, crmScope: "DONOR" }, orderBy: { updatedAt: "desc" }, take: 100 }) : [];
  const bindings = await prisma.createVariant.findMany({ where: { organizationId: org, legacyId: { not: null } }, select: { channel: true, legacyId: true, content: { select: { campaignId: true } } } });
  res.json({ items: [
    ...emails.filter(email => emailRecordAccessible(email, actor, req.user!.role)).map(email => ({ id: email.id, channel: "EMAIL", name: email.name, status: email.status, historical: email.status !== "DRAFT" || email.totalRecipients > 0 || !!email.sentAt || !!email.scheduledAt, isTemplate: email.status === "DRAFT" && !email.totalRecipients && !email.sentAt && !email.scheduledAt && !email.audienceFilter && !object(parseStored(email.templateJson)).templateSnapshot, updatedAt: email.updatedAt })),
    ...letters.map(letter => ({ id: letter.id, channel: "LETTER", name: letter.name, status: letter.status, historical: false, isTemplate: true, updatedAt: letter.updatedAt })),
  ].map(item => ({ ...item, campaignId: bindings.find(binding => binding.channel === item.channel && binding.legacyId === item.id)?.content.campaignId || null })), limited: emails.length === 100 || letters.length === 100 });
}));
router.get("/legacy/:channel/:id", route(async (req, res, org) => {
  const channel = param(req, "channel") as Channel; await demandChannels(req, [channel]);
  if (!["EMAIL", "LETTER"].includes(channel)) throw new CreateError(400, "Unknown legacy channel.");
  const binding = await prisma.createVariant.findFirst({ where: { organizationId: org, channel, legacyId: param(req) }, select: { contentId: true, content: { select: { campaignId: true } } } });
  if (binding) await assertCampaign(req, binding.content.campaignId);
  res.json(binding ? { campaignId: binding.content.campaignId, contentId: binding.contentId, channel } : { campaignId: null, channel, legacyId: param(req) });
}));
export async function importSource(req: Request, org: string, actor: string, channel: Channel, legacyId: string) {
  if (!["EMAIL", "LETTER"].includes(channel) || !legacyId) throw new CreateError(400, "Choose an existing email or donor letter.");
  await demandChannels(req, [channel], true);
  if (channel === "LETTER") await demand(req, "letters.create");
  const existing = await prisma.createVariant.findFirst({ where: { organizationId: org, channel, legacyId }, include: { content: true } });
  if (existing) { await assertCampaign(req, existing.content.campaignId, true); return { campaignId: existing.content.campaignId, contentId: existing.contentId }; }
  const native = await nativeRecord(org, { channel, legacyId });
  if (!native) throw new CreateError(404, "Source not found.");
  if (native.kind === "EMAIL" && !emailRecordAccessible(native.record, actor, req.user!.role, true)) throw new CreateError(403, "Only the owner or an administrator may import this email into managed content.");
  const historical = native.kind === "EMAIL" && (native.record.status !== "DRAFT" || !!native.record.sentAt || !!native.record.scheduledAt || native.record.totalRecipients > 0);
  const reusable = native.kind === "LETTER" || reusableEmailRecord(native.record);
  const audience = native.kind === "EMAIL" ? parseStored(native.record.audienceFilter) : {};
  const listIds = [...new Set([string(audience.recipientListId), ...(Array.isArray(audience.recipientListIds) ? audience.recipientListIds.filter((id): id is string => typeof id === "string") : [])].filter(Boolean))];
  const savedLists = listIds.length ? await prisma.emailRecipientList.findMany({ where: { organizationId: org, id: { in: listIds } }, select: { id: true } }) : [];
  // Only a verified round-trip source ID is sufficient to group companions. Never infer from names.
  const companionId = native.kind === "LETTER" ? string(object(native.record.printLayoutJson).sourceTemplateId) : "";
  const envelope = native.kind === "LETTER" ? object(native.record.printLayoutJson) : {};
  const companion = companionId && envelope.schema === "oyama-communication-roundtrip-v1" && await can(req, "edit:communications") ? await prisma.createVariant.findFirst({ where: { organizationId: org, channel: "EMAIL", legacyId: companionId }, include: { content: { include: { campaign: true } } } }) : null;
  if (companion) await assertCampaign(req, companion.content.campaignId, true);
  const result = await prisma.$transaction(async tx => {
    const campaign = companion?.content.campaign || await tx.createCampaign.create({ data: { organizationId: org, ownerId: actor, name: native.record.name, objective: "GENERAL", isTemplate: reusable, status: historical ? "HISTORICAL" : "DRAFT", audienceListIds: json(savedLists.map(list => list.id)), channelsJson: json([channel]) } });
    const content = companion?.content || await tx.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name: native.record.name, documentJson: json({ version: 1, blocks: [] }) } });
    if (companion) await tx.createCampaign.update({ where: { id: campaign.id }, data: { channelsJson: json([...new Set([...(campaign.channelsJson as Channel[]), channel])]), revision: { increment: 1 } } });
    else await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: 1, documentJson: json(content.documentJson), createdBy: actor } });
    await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel, legacyId, legacyFingerprint: native.fingerprint, nativeApproved: true, documentJson: json(variantFrom({ subject: native.kind === "EMAIL" ? native.record.subject : native.record.printSubject || native.record.name })) } });
    return { campaignId: campaign.id, contentId: content.id, historical, groupedCompanion: !!companion };
  }); return result;
}
router.post("/legacy/import", route(async (req, res, org, actor) => {
  res.status(201).json(await importSource(req, org, actor, string(req.body.channel) as Channel, string(req.body.legacyId)));
}));
export default router;
