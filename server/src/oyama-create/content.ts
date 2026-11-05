import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { json, buildProductionSnapshot } from "../services/letter-production.js";
import { renderProductionLetter } from "../services/letter-production-renderer.js";
import { resolveLetterMergeContext } from "../services/letters-execution.js";
import { demand, demandChannels, assertCampaign, touchCampaign } from "./access.js";
import { route, param } from "./http.js";
import { CHANNELS, CreateError, documentFrom, renderShared, required, string, variantFrom, type Channel } from "./domain.js";
import { adaptationIssues, nativeChanged, nativeRecord, syncNative } from "./legacy.js";

const router = Router();
export async function contentFor(req: Parameters<typeof assertCampaign>[0], id: string, manage = false) {
  const content = await prisma.createContent.findFirst({ where: { id, organizationId: req.user!.orgId }, include: { variants: true } });
  if (!content) throw new CreateError(404, "Content not found.");
  const campaign = await assertCampaign(req, content.campaignId, manage);
  return { content, campaign };
}
router.post("/campaigns/:id/contents", route(async (req, res, org, actor) => {
  const campaign = await assertCampaign(req, param(req), true); await demandChannels(req, campaign.channelsJson as Channel[], true);
  const document = documentFrom(req.body.document || { version: 1, blocks: [] });
  const content = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    const item = await tx.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name: required(req.body.name, "Content name"), documentJson: json(document) } });
    await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: item.id, revision: 1, documentJson: json(document), createdBy: actor } });
    for (const channel of campaign.channelsJson as Channel[]) await tx.createVariant.create({ data: { organizationId: org, contentId: item.id, channel, documentJson: json(variantFrom({ subject: item.name })) } });
    return item;
  }); res.status(201).json(content);
}));
router.patch("/contents/:id", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); await demandChannels(req, campaign.channelsJson as Channel[], true);
  if(content.designJson)throw new CreateError(409,"This content uses Studio. Edit its shared design in oyamaCreate Studio to preserve its structure.");
  const document = documentFrom(req.body.document);
  const scheduledAt = req.body.scheduledAt ? new Date(string(req.body.scheduledAt)) : null;
  if (scheduledAt && !Number.isFinite(scheduledAt.getTime())) throw new CreateError(400, "Choose a valid delivery date and time.");
  const changed = await Promise.all(content.variants.map(async variant => ({ id: variant.id, external: await nativeChanged(org, variant) })));
  const saved = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    const updated = await tx.createContent.updateMany({ where: { id: content.id, organizationId: org, revision: req.body.revision }, data: { name: required(req.body.name, "Content name"), documentJson: json(document), scheduledAt, revision: { increment: 1 } } });
    if (!updated.count) throw new CreateError(409, "This content has a newer saved revision. Your draft has been preserved.");
    const item = await tx.createContent.findUniqueOrThrow({ where: { id: content.id } });
    await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: item.id, revision: item.revision, documentJson: json(document), createdBy: actor } });
    for (const variant of content.variants) {
      const custom = Object.keys(variantFrom(variant.documentJson).overrides).length > 0;
      const review = custom || changed.find(row => row.id === variant.id)?.external || variant.nativeApproved;
      await tx.createVariant.update({ where: { id: variant.id }, data: { revision: { increment: 1 }, needsReview: !!review } });
      if (variant.legacyId && !review) await syncNative(tx, org, actor, item, variant);
    }
    return item;
  }); res.json({ ...saved, campaignRevision: campaign.revision + 1 });
}));
router.patch("/contents/:id/variants/:channel", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); const channel = param(req, "channel") as Channel;
  if (!CHANNELS.includes(channel) || !(campaign.channelsJson as Channel[]).includes(channel)) throw new CreateError(400, "This campaign does not use that channel.");
  await demandChannels(req, [channel], true);
  const variant = content.variants.find(row => row.channel === channel);
  if (!variant) throw new CreateError(404, "Channel version not found.");
  const format = variantFrom(req.body.document);
  if(content.designJson && ["EMAIL","LETTER"].includes(channel)) {
    const before=variantFrom(variant.documentJson);if(JSON.stringify({...before,scheduledAt:null,enabled:null})!==JSON.stringify({...format,scheduledAt:null,enabled:null}))throw new CreateError(409,"Edit structured letter/email content in Studio. This view can change channel delivery dates only.");
  }
  if (Object.keys(format.overrides).some(id => !documentFrom(content.documentJson).blocks.some(block => block.id === id))) throw new CreateError(400, "A customized block no longer exists in the shared document.");
  const external = await nativeChanged(org, variant).catch(error=>{if(content.designJson)return false;throw error;});
  const saved = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    const changed = await tx.createVariant.updateMany({ where: { id: variant.id, revision: req.body.revision }, data: { documentJson: json(format), revision: { increment: 1 }, needsReview: external || variant.nativeApproved } });
    if (!changed.count) throw new CreateError(409, "This format changed in another session. Reload before retrying.");
    const item = await tx.createVariant.findUniqueOrThrow({ where: { id: variant.id } });
    if (!content.designJson && item.legacyId && !external && !item.nativeApproved) await syncNative(tx, org, actor, content, item);
    return item;
  }); res.json({ ...saved, campaignRevision: campaign.revision + 1 });
}));
router.get("/contents/:id/preview/:channel", route(async (req, res, org) => {
  const { content } = await contentFor(req, param(req)); const channel = param(req, "channel") as Channel;
  const variant = content.variants.find(item => item.channel === channel);
  if (!variant) throw new CreateError(404, "Channel version not found.");
  await demandChannels(req, [channel]);
  const document = documentFrom(content.documentJson), format = variantFrom(variant.documentJson);
  const native = await nativeRecord(org, variant);
  const shared = renderShared(document, format);
  res.json({ revision: content.revision, variantRevision: variant.revision, ...shared, nativeHtml: native?.kind === "EMAIL" ? native.record.bodyHtml : native?.kind === "LETTER" ? native.record.printBody : null, externalChanges: await nativeChanged(org, variant), needsReview: variant.needsReview, adaptationIssues: adaptationIssues(channel, document, format) });
}));
router.post("/contents/:id/native/:channel", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); const channel = param(req, "channel") as Channel;
  if(content.designJson)throw new CreateError(409,"This content uses the integrated Studio editor. Edit its letter or email view there.");
  if (!["EMAIL", "LETTER"].includes(channel) || !(campaign.channelsJson as Channel[]).includes(channel)) throw new CreateError(400, "Choose an email or letter version.");
  await demandChannels(req, [channel], true);
  if (channel === "LETTER") await demand(req, "letters.create");
  const variant = content.variants.find(row => row.channel === channel)!;
  if (!variant.legacyId) await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    await syncNative(tx, org, actor, content, variant);
  });
  res.json(await prisma.createVariant.findUnique({ where: { id: variant.id } }));
}));
router.post("/contents/:id/review/:channel", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); const channel = param(req, "channel") as Channel;
  const variant = content.variants.find(row => row.channel === channel);
  if (!variant) throw new CreateError(404, "Channel version not found.");
  await demandChannels(req, [channel], true);
  if(content.designJson && ["EMAIL","LETTER"].includes(channel))throw new CreateError(409,"Review structured content and legacy differences in Studio; legacy synchronization cannot replace a rich design.");
  if (!["KEEP_NATIVE", "SYNC_SHARED", "KEEP_CUSTOMIZATIONS"].includes(req.body.choice)) throw new CreateError(400, "Choose how to review this format.");
  await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    if (req.body.variantRevision !== variant.revision) throw new CreateError(409, "The format changed. Reload its preview before reviewing.");
    const native = await nativeRecord(org, variant, tx);
    if (req.body.choice === "KEEP_NATIVE" && !native) throw new CreateError(400, "Open the format editor before reviewing its native layout.");
    if (req.body.choice === "SYNC_SHARED") {
      const relinked = await tx.createVariant.update({ where: { id: variant.id }, data: { documentJson: json({ ...variantFrom(variant.documentJson), overrides: {} }) } });
      await syncNative(tx, org, actor, content, relinked, true);
    } else if (req.body.choice === "KEEP_CUSTOMIZATIONS" && native && native.fingerprint === variant.legacyFingerprint) await syncNative(tx, org, actor, content, variant);
    else if (native && req.body.choice !== "KEEP_NATIVE" && native.fingerprint !== variant.legacyFingerprint) throw new CreateError(409, "Review the external layout changes explicitly before continuing.");
    await tx.createVariant.update({ where: { id: variant.id }, data: { needsReview: false, revision: { increment: 1 }, ...(req.body.choice === "KEEP_NATIVE" ? { nativeApproved: true, legacyFingerprint: native!.fingerprint } : {}) } });
  }); res.json({ reviewed: true });
}));
router.get("/contents/:id/revisions", route(async (req, res, org) => {
  await contentFor(req, param(req));
  res.json(await prisma.createDocumentRevision.findMany({ where: { contentId: param(req), organizationId: org }, orderBy: { revision: "desc" }, take: 50 }));
}));
router.post("/contents/:id/proof", route(async (req, res, org, actor) => {
  const { content } = await contentFor(req, param(req)); await demand(req, "letters.export_pdf");
  const variant = content.variants.find(item => item.channel === "LETTER");
  if (!variant?.legacyId) throw new CreateError(422, "Open the letter layout editor once before generating its PDF proof.");
  const native = await nativeRecord(org, variant);
  if (native?.kind !== "LETTER") throw new CreateError(404, "Letter not found.");
  const constituentId = string(req.body.constituentId) || undefined;
  if (constituentId) await demand(req, "letters.view_sensitive_merge_data");
  const merged = await resolveLetterMergeContext({ organizationId: org, actorUserId: actor, template: native.record, constituentId });
  const snapshot = await buildProductionSnapshot({ organizationId: org, templateId: native.record.id, bodyHtml: merged.mergedPrintBody, subject: merged.mergedPrintSubject || "", recipientId: constituentId, blockers: merged.unsupportedFields.map(field => `Unsupported field: ${field}`) });
  const proof = await renderProductionLetter(snapshot);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=campaign-letter-proof.pdf", "X-Content-Type-Options": "nosniff" }).send(proof.bytes);
}));
export default router;
