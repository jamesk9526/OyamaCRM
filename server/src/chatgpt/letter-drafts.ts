import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { managedPublicMedia, mapHtmlImageSources } from "../lib/public-media.js";
import { demand } from "../oyama-create/access.js";
import { contentFor } from "../oyama-create/content.js";
import { CreateError, variantFrom } from "../oyama-create/domain.js";
import { isTrashed } from "../oyama-create/trash-state.js";
import { managedAssetIssues } from "../oyama-create/studio/asset-files.js";
import { baselineBrand, brandForDesign, brandForStudio } from "../oyama-create/studio/brand-service.js";
import { channelDesign, defaultDesign, DONOR_FIELDS, normalizeDesign, sourceIdentity, walkNodes } from "../oyama-create/studio/design.js";
import { classicStudioEdit, classicWorkingCopy, persistClassicLetter } from "../oyama-create/classic-letter.js";
import { emptyDonor, regionIssues, renderRegion, renderStudio } from "../oyama-create/studio/render.js";
import type { DonorContext, StudioIssue } from "../oyama-create/studio/types.js";
import { json } from "../services/letter-production.js";
import { collectMergeFieldKeys } from "../services/letters-merge.js";
import { applyLetterChanges, type LetterChanges } from "./letter-design.js";
import { LETTER_DESIGN_OPTIONS } from "./letter-tool-contract.js";
import { toolFingerprint, withToolReceipt } from "./receipts.js";

const editorUrl = (origin: string, campaignId: string) => `${origin}/oyama-create/campaigns/${campaignId}`;
const latestBrand = (org: string) => prisma.createBrandRevision.findFirst({ where: { organizationId: org }, orderBy: { revision: "desc" }, select: { id: true } });

async function studioLetter(req: Request, id: string, manage = false) {
  const org = req.user!.orgId;
  const { content, campaign } = await contentFor(req, id, manage);
  const variant = content.variants.find(item => item.channel === "LETTER");
  if (!variant || await isTrashed(org, "CONTENT", id) || await isTrashed(org, "CAMPAIGN", campaign.id)) throw new CreateError(404, "Letter not found.");
  if (!content.designJson) throw new CreateError(409, "Open this letter in Studio to convert it before using Studio layout and merge tools.");
  return { content, campaign, variant };
}

export async function createLetterDraft(req: Request, grantId: string, origin: string, input: LetterChanges & { name: string; html: string; requestKey: string }) {
  await demand(req, "letters.create");
  await demand(req, "letters.edit");
  const { orgId: org, sub: actor } = req.user!, { name, html, requestKey, ...options } = input;
  // Preserve the fingerprint of existing HTML-only requests across upgrades.
  const fingerprint = toolFingerprint(Object.keys(options).length ? [name, html, options] : [name, html]);
  return withToolReceipt(grantId, requestKey, fingerprint, async record => {
    const brandRevision = await latestBrand(org);
    const brand = await brandForDesign(org, brandRevision?.id || null);
    const { design, diagnostics } = await applyLetterChanges(org, { ...defaultDesign(), version: 3 }, brand, { html, ...options });
    design.brandRevisionId = brandRevision?.id || await baselineBrand(org, actor);
    return prisma.$transaction(async tx => {
      const campaign = await tx.createCampaign.create({ data: { organizationId: org, name, ownerId: actor, audienceListIds: [], channelsJson: ["LETTER"] } });
      const content = await tx.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name, documentJson: { version: 1, blocks: [] }, designJson: json(design) } });
      await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel: "LETTER", documentJson: {}, needsReview: true } });
      await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: 1, documentJson: json({ shared: content.documentJson, studio: design }), createdBy: actor } });
      const result = { id: content.id, campaignId: campaign.id, revision: 1, status: "DRAFT", url: editorUrl(origin, campaign.id), diagnostics, reviewRequired: true };
      await record(tx, result);
      return result;
    });
  });
}

export async function updateLetterDraft(req: Request, grantId: string, origin: string, input: LetterChanges & { id: string; revision: number; requestKey: string }) {
  await demand(req, "letters.create");
  await demand(req, "letters.edit");
  const { orgId: org, sub: actor } = req.user!, { id, revision, requestKey, ...changes } = input;
  if (!changes.html && !Object.keys(changes.layout || {}).length && !changes.insertBlocks?.length) throw new CreateError(400, "Supply letter HTML, layout settings or blocks to insert.");
  return withToolReceipt(grantId, requestKey, toolFingerprint(["update_letter_draft", id, revision, changes]), async record => {
    const { content, campaign, variant } = await studioLetter(req, id, true);
    if (campaign.ownerId !== actor) throw new CreateError(403, "Edit a draft you created through this MCP connection or save a new copy.");
    const grants = await prisma.chatGptGrant.findMany({ where: { userId: actor, organizationId: org }, select: { id: true } });
    const createdViaMcp = await prisma.chatGptDraftRequest.findFirst({
      where: { grantId: { in: grants.map(grant => grant.id) }, resultJson: { path: "$.id", equals: id } }, select: { id: true },
    });
    if (!createdViaMcp) throw new CreateError(403, "Edit a draft you created through ChatGPT or save a new draft copy.");
    const channels = campaign.channelsJson;
    if (campaign.status !== "DRAFT" || campaign.isTemplate || campaign.fundraisingCampaignId || campaign.eventId ||
        !Array.isArray(campaign.audienceListIds) || campaign.audienceListIds.length ||
        !Array.isArray(channels) || channels.length !== 1 || channels[0] !== "LETTER" || content.variants.length !== 1 ||
        variant.legacyId || variant.nativeApproved || variantFrom(variant.documentJson).scheduledAt || content.scheduledAt || campaign.startsAt || campaign.endsAt) {
      throw new CreateError(409, "This letter has moved beyond standalone draft editing. Open the CRM editor or save a new copy.");
    }
    if (content.revision !== revision) throw new CreateError(409, "The letter changed. Read its current revision before editing.");
    const working = await classicWorkingCopy(org, id);
    const old = normalizeDesign(content.designJson), brand = await brandForStudio(org, old, "LETTER");
    const scoped = working ? channelDesign(old, "LETTER") : old;
    const { design, diagnostics } = await applyLetterChanges(org, scoped, brand, changes, content.designJson);
    const edit = working ? await classicStudioEdit(req, content, working, {
      ...design, body: old.body, channels: { ...old.channels, LETTER: { ...old.channels?.LETTER, document: design.body, reviewedSource: null } },
    }, diagnostics) : null;
    if (edit?.design.channels?.LETTER) edit.design.channels.LETTER.reviewedSource = sourceIdentity(edit.design);
    return prisma.$transaction(async tx => {
      // The campaign revision also guards approval and edits made in the regular Studio UI.
      const claim = await tx.createCampaign.updateMany({
        where: { id: campaign.id, organizationId: org, ownerId: actor, status: "DRAFT", revision: campaign.revision, releases: { none: {} }, contents: { none: { id: { not: id } } } },
        data: { revision: { increment: 1 } },
      });
      if (!claim.count || await isTrashed(org, "CAMPAIGN", campaign.id, tx) || await isTrashed(org, "CONTENT", id, tx)) {
        throw new CreateError(409, "This campaign changed or already has release history. Check its current status in Create.");
      }
      if (working && edit) await persistClassicLetter(tx, content, actor, edit, working);
      else {
        const saved = await tx.createContent.updateMany({ where: { id, organizationId: org, revision }, data: { designJson: json(design), revision: { increment: 1 } } });
        if (!saved.count) throw new CreateError(409, "The letter changed. Read its current revision before editing.");
        await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: id, revision: revision + 1, documentJson: json({ shared: content.documentJson, studio: design }), createdBy: actor } });
      }
      await tx.createVariant.update({ where: { id: variant.id }, data: { needsReview: true } });
      const result = { id, campaignId: campaign.id, revision: revision + 1, status: "DRAFT", url: editorUrl(origin, campaign.id), diagnostics, reviewRequired: true };
      await record(tx, result);
      return result;
    });
  });
}

const inlineFields = ["donor.firstName", "donor.lastName", "donor.fullName", "donor.preferredName", "donor.salutation", "donor.organizationName", "donor.addressBlock", "organization.name", "organization.website", "organization.mission", "currentDate", "year"];
const literalPlaceholders = {
  "[Date]": "Use {{currentDate}} if the date should merge at generation time.",
  "[First Name]": "Use {{donor.firstName}} or {{donor.salutation}} for recipient personalization.",
  "[Sender Name]": "Use a signature block to select the sender's approved name and title.",
  "[Website or Giving Link]": "Set the giving URL and insert a giving link block.",
};

export async function letterDesignOptions(req: Request, id?: string) {
  await demand(req, "letters.view");
  const org = req.user!.orgId;
  const brand = id ? await brandForStudio(org, normalizeDesign((await studioLetter(req, id)).content.designJson), "LETTER")
    : await brandForDesign(org, (await latestBrand(org))?.id || null);
  return {
    ...LETTER_DESIGN_OPTIONS, inlineMergeTokens: inlineFields.map(field => `{{${field}}}`), fieldBlocks: DONOR_FIELDS,
    example: '<p>Dear {{donor.salutation | fallback: "Friend"}},</p>',
    notes: ["Use the HTML tokens in text. Field blocks format dates and currency using Studio's recipient context.", "Recipient, gift and campaign fields resolve during CRM proofing. Response codes are assigned at approval.", "afterBlock is a 1-based position in the letter body before insertions. 0 prepends and an omitted position appends."],
    presets: brand.presets.filter(item => item.active && !item.trashed).slice(0, 100).map(({ id: presetId, name, kind, isDefault }) => ({ id: presetId, name, kind, isDefault })),
    signers: brand.signers.filter(item => item.active && !item.trashed).slice(0, 100).map(({ id: signerId, name }) => ({ id: signerId, name })),
  };
}

export async function previewLetterDraft(req: Request, origin: string, id: string, revision?: number) {
  await demand(req, "letters.view");
  const org = req.user!.orgId, { content, campaign } = await studioLetter(req, id);
  if (campaign.status === "HISTORICAL") throw new CreateError(409, "Review frozen historical output in OyamaCRM.");
  if (revision !== undefined && revision !== content.revision) throw new CreateError(409, "The letter has a newer saved revision. Read it before reviewing the preview.");
  // Preserved source snapshots can include personalized, historical output.
  const design = normalizeDesign(content.designJson);
  const pinnedBrand = await brandForStudio(org, design, "LETTER");
  const brand = { ...pinnedBrand, identity: { ...pinnedBrand.identity, taxId: "SAMPLE-TAX-ID" } };
  const donor: DonorContext = {
    ...emptyDonor(), available: true, sensitiveAllowed: true, entityKind: "INDIVIDUAL", name: "Jordan Example", salutation: "Jordan",
    address: "100 Sample Avenue\nExample City, ST 00000", mergeValues: { "donor.firstName": "Jordan", "donor.lastName": "Example", "donor.preferredName": "Jordan", "donor.displayName": "Jordan Example", "donor.organizationName": "Example Organization" },
    gift: { id: "sample", amount: 75, date: "2026-01-15", fund: "Sample fund", receiptNumber: "SAMPLE", deductible: 75 },
    giving: { total: 150, count: 2, largest: 75, lastAmount: 75, firstDate: "2026-01-15", lastDate: "2026-02-15", gifts: [] },
    pledge: { amount: 300, paid: 150, balance: 150, due: null },
  };
  const rendered = renderStudio(design, donor, brand, { channel: "LETTER", sample: true });
  const separateReply = design.pack.replySlip.enabled && design.pack.replySlip.placement === "separate"
    ? renderStudio(design, donor, brand, { channel: "LETTER", artifact: "REPLY_SLIP", sample: true }) : null;
  const chrome = (["firstHeader", "header", "firstFooter", "footer"] as const).map(key => renderRegion(design, donor, brand, key));
  const html = [rendered.html, separateReply?.html || "", ...chrome].join("\n");
  const issues: StudioIssue[] = [...rendered.issues, ...(separateReply?.issues || []), ...regionIssues(design, donor, brand), ...await managedAssetIssues(org, html)];
  let unmanagedImage = false;
  mapHtmlImageSources(html, source => {
    const media = managedPublicMedia(source);
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(source) && (!media || media.organizationId !== org || !/\.(png|jpe?g|webp)$/i.test(media.fileName))) unmanagedImage = true;
    return source;
  });
  if (unmanagedImage) issues.push({ code: "UNMANAGED_IMAGE", message: "Replace external or unsupported images with a managed PNG, JPEG or WebP before printing.", blocking: true });
  const body = design.channels?.LETTER?.document || design.body;
  const nodes = [body, ...(design.pack.replySlip.enabled ? [design.pack.replySlip.content] : [])].flatMap(walkNodes);
  const tokens = collectMergeFieldKeys(...nodes.map(node => node.text || (node.type === "studioHtml" ? String(node.attrs?.html || "") : "")));
  const fields = [...new Set(nodes.filter(node => node.type === "studioField").map(node => node.attrs?.field))];
  const preview = [rendered.text, separateReply?.text].filter(Boolean).join("\n\nReply slip\n");
  for (const [placeholder, suggestion] of Object.entries(literalPlaceholders)) {
    if (preview.includes(placeholder)) issues.push({ code: "LITERAL_PLACEHOLDER", message: `${placeholder} will print as written. ${suggestion}`, blocking: false });
  }
  return {
    id, revision: content.revision, sample: true, previewText: preview.slice(0, 12000), previewTruncated: preview.length > 12000,
    inlineFields: tokens.slice(0, 100), fieldBlocks: fields, bodyBlockCount: body.content.length, issues: issues.slice(0, 50), issueCount: issues.length,
    page: design.page, printPack: { replySlip: design.pack.replySlip.enabled, outerEnvelope: design.pack.outerEnvelope.enabled, returnEnvelope: design.pack.returnEnvelope.enabled },
    url: editorUrl(origin, campaign.id), reviewRequired: true, next: "Review the saved draft in Create. Use the PDF proof to check pagination and recipient merge results.",
  };
}
