import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { demand, demandChannels, touchCampaign } from "./access.js";
import { classicInitialDesign, classicWorkingCopy } from "./classic-letter.js";
import { contentFor } from "./content.js";
import { CreateError, variantFrom, type Channel } from "./domain.js";
import { param, route } from "./http.js";
import { LETTER_ADAPTATION_CHANNELS, applyLetterAdaptation, compareLetterAdaptation, projectLetterAdaptation, readLetterAdaptation, type LetterAdaptationChannel } from "./letter-adaptations.js";
import { fingerprint, nativeRecord } from "./legacy.js";
import { assertStudioAssetOwnership } from "./studio/asset-ownership.js";
import { baselineBrand } from "./studio/brand-service.js";
import { convertLegacy } from "./studio/conversion.js";
import { normalizeDesign, sourceIdentity } from "./studio/design.js";
import { emailEditingDocument } from "./studio/email-document.js";
import { paragraph } from "./studio/registry.js";
import { EMPTY_DOC } from "./studio/types.js";
import { upgradeUnifiedDesign } from "./studio/unified-document.js";

const router = Router();

router.post("/contents/:id/letter/adaptations/:channel", route(async (req, res, org, actor) => {
  const channel = param(req, "channel") as LetterAdaptationChannel;
  if (!LETTER_ADAPTATION_CHANNELS.includes(channel) || !["preview", "apply", "keep"].includes(req.body.action)) {
    throw new CreateError(400, "Choose a destination format and a conversion review action.");
  }
  const { content, campaign } = await contentFor(req, param(req), true);
  await demand(req, "letters.view");
  await demandChannels(req, [...new Set([...(campaign.channelsJson as Channel[]), channel])], true);
  if (campaign.status !== "DRAFT") throw new CreateError(409, "Duplicate this campaign before creating or updating a format draft.");
  const letter = await classicWorkingCopy(org, content.id);
  if (!letter) throw new CreateError(422, "Save the Letter draft first.");
  let design = classicInitialDesign(content);
  const variant = content.variants.find(item => item.channel === channel);
  const current = variantFrom(variant?.documentJson);
  const prior = readLetterAdaptation(variant?.letterAdaptationJson);
  const bound = channel === "EMAIL" && variant?.legacyId ? await nativeRecord(org, variant, prisma, true) : null;
  if (bound?.kind === "EMAIL" && (bound.record.status !== "DRAFT" || bound.record.sentAt || bound.record.totalRecipients)) {
    throw new CreateError(409, "Use the historical email as a new draft before adapting this letter.");
  }
  let document = design.channels?.[channel]?.document;
  let presentation = design.channels?.[channel]?.presentation;
  if (!document && channel === "EMAIL") {
    if (Object.keys(design.email.overrides).length) document = emailEditingDocument(design);
    else if (bound?.kind === "EMAIL") {
      const original = convertLegacy(bound.record, "EMAIL").design;
      document = original.body; presentation = original.presentation;
      design.email.subject ||= original.email.subject;
      design.email.previewText ||= original.email.previewText;
    }
  }
  document ||= current.caption.trim() && (channel === "SOCIAL" || channel === "SMS")
    ? { type: "doc", content: [paragraph("retained-caption", current.caption)] } : EMPTY_DOC();
  const projected = projectLetterAdaptation(letter, design, channel);
  if (projected.content.length > 1000 || (prior?.links.length || 0) > 1000) throw new CreateError(422, "This letter has too many sections to convert at once. Use a smaller content piece.");
  const { steps, changes } = compareLetterAdaptation(prior, document, projected.content);
  const review = fingerprint([content.id, content.revision, campaign.revision, variant?.revision || 0, letter.revision, bound?.fingerprint, changes]);
  const warnings = [...projected.warnings];
  if (!projected.content.length) warnings.push("No reusable copy was found. Add content directly in this format.");
  if (req.body.action === "preview") {
    res.json({ review, changes, warnings, linked: !!prior, letterRevision: letter.revision, existing: !!variant });
    return;
  }
  if (req.body.review !== review) throw new CreateError(409, "The Letter or destination draft changed. Review the latest differences before applying them.");
  if (req.body.action === "keep" && !prior) throw new CreateError(422, "Create a linked format before dismissing a Letter update.");
  const selected = req.body.action === "keep" ? [] : req.body.selected;
  if (!Array.isArray(selected) || selected.some(id => !Number.isInteger(id) || !changes[id] || changes[id].action === "conflict")) throw new CreateError(400, "Choose the available sections to apply.");
  if (!selected.length && req.body.action === "apply" && changes.length) throw new CreateError(400, "Select at least one section to apply.");
  const result = applyLetterAdaptation(document, steps, new Set<number>(selected), channel, review.slice(0, 12));
  let writeDesign = false;
  if (req.body.action === "apply") {
    const previous = design.channels?.[channel];
    design.brandRevisionId ||= design.presentation?.sourceRevisionId ? null : await baselineBrand(org, actor);
    const before = sourceIdentity(design);
    design.channels = { ...design.channels, [channel]: { ...previous, document: result.document, reviewedSource: sourceIdentity(design), ...(presentation ? { presentation } : {}) } };
    if (channel === "EMAIL") design.email.subject ||= current.subject || content.name;
    design = normalizeDesign(upgradeUnifiedDesign(design));
    for (const format of Object.values(design.channels || {})) if (format.reviewedSource === before) format.reviewedSource = sourceIdentity(design);
    assertStudioAssetOwnership(org, design);
    writeDesign = true;
  } else if (design.channels?.[channel] && design.channels[channel]!.reviewedSource !== sourceIdentity(design)) {
    design.channels[channel]!.reviewedSource = sourceIdentity(design);
    writeDesign = true;
  }
  await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, campaign.revision);
    const liveLetter = await classicWorkingCopy(org, content.id, tx);
    if (liveLetter?.revision !== letter.revision) throw new CreateError(409, "The working Letter changed. Refresh its conversion preview.");
    if (bound && variant && (await nativeRecord(org, variant, tx, true))?.fingerprint !== bound.fingerprint) throw new CreateError(409, "The original email changed. Review its latest version first.");
    const lineage = json({ version: 1, letterRevision: letter.revision, links: result.links });
    if (variant) {
      const changed = await tx.createVariant.updateMany({ where: { id: variant.id, organizationId: org, revision: variant.revision },
        data: { letterAdaptationJson: lineage, revision: { increment: 1 }, needsReview: false } });
      if (changed.count !== 1) throw new CreateError(409, "The destination draft changed. Refresh its conversion preview.");
    } else {
      await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel, documentJson: json({ ...current, enabled: false }), letterAdaptationJson: lineage } });
    }
    const channels = campaign.channelsJson as Channel[];
    if (!channels.includes(channel)) await tx.createCampaign.update({ where: { id: campaign.id }, data: { channelsJson: json([...channels, channel]) } });
    if (writeDesign) {
      const changed = await tx.createContent.updateMany({ where: { id: content.id, organizationId: org, revision: content.revision }, data: { designJson: json(design), revision: { increment: 1 } } });
      if (changed.count !== 1) throw new CreateError(409, "The content changed during conversion.");
      await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: content.revision + 1, createdBy: actor, documentJson: json({ shared: content.documentJson, studio: design }) } });
    }
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_LETTER_ADAPTATION_REVIEWED", entity: "CreateContent", entityId: content.id,
      metadata: { channel, action: req.body.action, letterRevision: letter.revision, sectionsApplied: selected.length } } });
  });
  res.json({ channel, campaignRevision: campaign.revision + 1, revision: content.revision + (writeDesign ? 1 : 0) });
}));

export default router;
