import { Router } from "express";
import type { CreateCampaign, CreateContent, CreateVariant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { json, buildProductionSnapshot, productionEnabled } from "../services/letter-production.js";
import type { LetterSnapshot } from "../services/letter-production-contract.js";
import { resolveLetterMergeContext } from "../services/letters-execution.js";
import { createOrganizationEmailSender } from "../services/smtp-service.js";
import { buildCampaignDeliveryBodies, validateCampaignSendReadiness } from "../routes/email-campaigns.js";
import { loadOrganizationBrandingContext } from "../services/organization-branding.js";
import { assertCampaign, demand, demandChannels } from "./access.js";
import { collectMergeFieldKeys } from "../services/letters-merge.js";
import { route, param } from "./http.js";
import { resolvePlan } from "./audiences.js";
import { adaptationIssues, emailRecordSharing, fingerprint, nativeRecord } from "./legacy.js";
import { CreateError, documentFrom, object, publicCopySafe, renderShared, variantFrom, type Channel, type DeliveryMode, type SharedDocument, type VariantDocument } from "./domain.js";
import { metaAccount } from "./providers.js";
const router = Router();
export type FrozenVariant = { channel: Channel; revision: number; format: VariantDocument; html: string; text: string; nativeFingerprint: string | null; sourceSharing?: { ownerId: string | null; sharedWithOrganization: boolean }; email?: { name: string; subject: string; purpose: string; previewText: string | null; fromName: string; fromEmail: string; replyToEmail: string | null; bodyHtml: string | null; bodyText: string | null; templateJson: string | null }; letterBase?: LetterSnapshot };
export type FrozenContent = { id: string; name: string; revision: number; scheduledAt: string; document: SharedDocument; variants: FrozenVariant[] };
export type ReleaseSnapshot = { version: 1; campaign: { id: string; name: string; objective: string; revision: number; fundraisingCampaignId: string | null; eventId: string | null }; contents: FrozenContent[]; audience: { total: number; overlap: number; excluded: number; counts: Record<string, number> } };

export async function readiness(campaign: CreateCampaign, contents: Array<CreateContent & { variants: CreateVariant[] }>, actor: string, freeze = false) {
  const org = campaign.organizationId, channels = campaign.channelsJson as Channel[];
  const issues: Array<{ channel: string; message: string }> = []; const frozen: FrozenContent[] = [];
  if (campaign.isTemplate) issues.push({ channel: "ALL", message: "Use this template to create a campaign before approval." });
  if (campaign.status === "HISTORICAL") issues.push({ channel: "ALL", message: "Historical content is read-only. Duplicate it into a new campaign." });
  if (!contents.length) issues.push({ channel: "ALL", message: "Add at least one content piece." });
  const plan = await resolvePlan(org, campaign.audienceListIds as string[], channels, campaign.deliveryMode as DeliveryMode | null, campaign.objective);
  if (channels.some(channel => ["EMAIL", "LETTER", "SMS"].includes(channel)) && !plan.recipients.length) issues.push({ channel: "ALL", message: "The selected audiences have no eligible recipients for the delivery plan." });
  const connections = await prisma.createConnection.findMany({ where: { organizationId: org } });
  if (channels.includes("EMAIL")) await createOrganizationEmailSender(org).catch(() => issues.push({ channel: "EMAIL", message: "Configure and verify the organization's email transport." }));
  if (channels.includes("LETTER") && !await productionEnabled(org)) issues.push({ channel: "LETTER", message: "Enable and verify structured letter production in Settings before releasing print work." });
  if (channels.includes("SMS") && !connections.some(row => row.provider === "AZURE_SMS" && row.readyAt)) issues.push({ channel: "SMS", message: "Verify the Azure SMS sender and Event Grid connection in Settings." });
  if (channels.includes("SOCIAL") && !connections.some(row => row.provider === "META" && row.readyAt)) issues.push({ channel: "SOCIAL", message: "Verify a Meta connection with publishing permissions in Settings." });
  for (const content of contents) {
    const document = documentFrom(content.documentJson);
    const item: FrozenContent = { id: content.id, name: content.name, revision: content.revision, document, scheduledAt: (content.scheduledAt || campaign.startsAt || new Date()).toISOString(), variants: [] };
    for (const channel of channels) {
      const variant = content.variants.find(row => row.channel === channel);
      if (!variant) { issues.push({ channel, message: `${content.name}: create this format.` }); continue; }
      const format = variantFrom(variant.documentJson); const native = await nativeRecord(org, variant).catch(error => { issues.push({ channel, message: error.message }); return null; });
      if (variant.needsReview || (native && native.fingerprint !== variant.legacyFingerprint)) issues.push({ channel, message: `${content.name}: review changed shared copy or native layout.` });
      const shared = renderShared(document, format);
      const version: FrozenVariant = { channel, revision: variant.revision, format, ...shared, nativeFingerprint: native?.fingerprint || null };
      for (const message of adaptationIssues(channel, document, format)) if (channel === "SMS" && message.includes("exceeds")) issues.push({ channel, message: `${content.name}: ${message}` });
      if (["WEB", "SMS", "SOCIAL"].includes(channel) && !publicCopySafe(document, format)) issues.push({ channel, message: `${content.name}: recipient merge fields cannot appear in public pages, SMS, or social copy. Use literal public copy.` });
      if (channel === "EMAIL") {
        if (native?.kind !== "EMAIL") issues.push({ channel, message: `${content.name}: open the email layout editor and review its sender/compliance settings.` });
        else {
          if (native.record.status !== "DRAFT" || native.record.sentAt || native.record.totalRecipients) issues.push({ channel, message: `${content.name}: duplicate this historical email before using it in a new release.` });
          const emailRecipients = plan.recipients.filter(row => row.channel === "EMAIL").map(row => row.key);
          const validation = await validateCampaignSendReadiness({ campaign: native.record, sendOptions: { sendMode: "LIST", recipientEmails: emailRecipients } });
          for (const check of validation.checks.filter(check => check.blocking && !check.passed && (emailRecipients.length > 0 || check.key !== "audience"))) issues.push({ channel, message: `${content.name}: ${check.detail}` });
          const { name, subject, purpose, previewText, fromName, fromEmail, replyToEmail, bodyHtml, bodyText, templateJson } = native.record;
          const approved = buildCampaignDeliveryBodies(native.record, purpose, await loadOrganizationBrandingContext(org));
          version.sourceSharing = emailRecordSharing(native.record);
          version.email = { name, subject, purpose, previewText, fromName, fromEmail, replyToEmail, bodyHtml: approved.html || bodyHtml, bodyText: approved.text || bodyText, templateJson };
        }
      }
      if (channel === "LETTER") {
        if (native?.kind !== "LETTER") issues.push({ channel, message: `${content.name}: open and review the letter layout.` });
        else if (freeze) {
          try { version.letterBase = await buildProductionSnapshot({ organizationId: org, templateId: native.record.id, bodyHtml: native.record.printBody, subject: native.record.printSubject || "" }); }
          catch (error) { issues.push({ channel, message: `${content.name}: ${error instanceof Error ? error.message : "Print assets could not be frozen."}` }); }
        }
      }
      if (channel === "WEB" && (!document.blocks.length || !publicCopySafe(document, format))) issues.push({ channel, message: `${content.name}: add public content without recipient tokens.` });
      if (channel === "WEB" && format.formEnabled && !format.consentText.trim()) issues.push({ channel, message: `${content.name}: provide the exact form consent wording.` });
      if (channel === "SMS" && !(format.caption || shared.text).trim()) issues.push({ channel, message: `${content.name}: add SMS text.` });
      if (channel === "SOCIAL") {
        const connection = connections.find(row => row.provider === "META" && row.readyAt);
        if (!(format.caption || shared.text).trim()) issues.push({ channel, message: `${content.name}: add a social caption.` });
        if (connection) {
          try {
            const account = metaAccount(connection, format.accountId);
            if (format.network === "INSTAGRAM" && (!account.account.instagramId || object(connection.configJson).instagramReady !== true || !format.mediaUrl)) issues.push({ channel, message: `${content.name}: Instagram requires a connected professional account, publishing scope, and a public image URL.` });
          } catch (error) { issues.push({ channel, message: error instanceof Error ? error.message : "Choose a connected social account." }); }
        }
      }
      if (format.requiresLandingPage && !channels.includes("WEB")) issues.push({ channel, message: `${content.name}: select the Web channel before requiring its campaign URL.` });
      item.variants.push(version);
    }
    frozen.push(item);
  }
  return { issues, plan, frozen };
}
router.get("/campaigns/:id/readiness", route(async (req, res, org, actor) => {
  const campaign = await assertCampaign(req, param(req));
  const contents = await prisma.createContent.findMany({ where: { organizationId: org, campaignId: campaign.id }, include: { variants: true } });
  const { issues, plan, frozen } = await readiness(campaign, contents, actor);
  const summary = { total: plan.total, overlap: plan.overlap, excluded: plan.excluded, missingEmail: plan.missingEmail, missingPostal: plan.missingPostal, missingSmsConsent: plan.missingSmsConsent, counts: plan.counts };
  const schedules = frozen.flatMap(content => content.variants.map(variant => ({ contentId: content.id, contentName: content.name, channel: variant.channel, scheduledAt: variant.format.scheduledAt || content.scheduledAt })));
  res.json({ campaignRevision: campaign.revision, ready: !issues.length, issues, eligibility: summary, schedules });
}));
router.post("/campaigns/:id/approve", route(async (req, res, org, actor) => {
  const campaign = await assertCampaign(req, param(req), true); await demandChannels(req, campaign.channelsJson as Channel[], true, true);
  if (req.body.confirm !== true || req.body.revision !== campaign.revision) throw new CreateError(409, "Review the current campaign revision and confirm its delivery plan.");
  const contents = await prisma.createContent.findMany({ where: { organizationId: org, campaignId: campaign.id }, include: { variants: true } });
  for (const content of contents) {
    const letterVariant = content.variants.find(item => item.channel === "LETTER");
    const native = letterVariant ? await nativeRecord(org, letterVariant) : null;
    if (native?.kind === "LETTER" && collectMergeFieldKeys(native.record.printBody, native.record.printSubject).some(field => /^(gift\.|year|donor\.(?:total|lifetime)|total)/i.test(field))) await demand(req, "letters.view_sensitive_merge_data");
  }
  const prepared = await readiness(campaign, contents, actor, true);
  if (prepared.issues.length) { res.status(422).json({ error: { message: "Resolve readiness issues before approval." }, issues: prepared.issues }); return; }
  const snapshot: ReleaseSnapshot = { version: 1, campaign: { id: campaign.id, name: campaign.name, objective: campaign.objective, revision: campaign.revision, fundraisingCampaignId: campaign.fundraisingCampaignId, eventId: campaign.eventId }, contents: prepared.frozen, audience: { total: prepared.plan.total, overlap: prepared.plan.overlap, excluded: prepared.plan.excluded, counts: prepared.plan.counts } };
  const jobs: Array<{ contentId: string; channel: Channel; recipientKey: string; scheduledAt: Date; payloadJson: ReturnType<typeof json> }> = [];
  for (const content of contents) {
    const frozen = prepared.frozen.find(item => item.id === content.id)!;
    const scheduledAt = (channel: Channel) => new Date(frozen.variants.find(variant => variant.channel === channel)?.format.scheduledAt || frozen.scheduledAt);
    for (const recipient of prepared.plan.recipients) {
      let letter: Partial<LetterSnapshot> | null = null;
      if (recipient.channel === "LETTER") {
        const variant = content.variants.find(row => row.channel === "LETTER")!; const native = await nativeRecord(org, variant);
        if (native?.kind !== "LETTER") throw new CreateError(422, "Letter layout not found.");
        const merged = await resolveLetterMergeContext({ organizationId: org, actorUserId: actor, template: native.record, constituentId: recipient.member.constituentId!, campaignId: campaign.fundraisingCampaignId || undefined, eventId: campaign.eventId || undefined });
        if (merged.missingFields.length || merged.unsupportedFields.length) throw new CreateError(422, `${recipient.member.firstName} ${recipient.member.lastName}: letter merge values are missing or unsupported. Review the recipient proof.`);
        letter = { bodyHtml: merged.mergedPrintBody, subject: merged.mergedPrintSubject || "", recipientId: recipient.member.constituentId, recipient: { name: recipient.member.name || `${recipient.member.firstName} ${recipient.member.lastName}`.trim(), addressLine1: recipient.member.addressLine1, addressLine2: recipient.member.addressLine2, city: recipient.member.city, state: recipient.member.state, zip: recipient.member.zip }, warnings: [], blockers: [] };
      }
      jobs.push({ contentId: content.id, channel: recipient.channel, recipientKey: recipient.key, scheduledAt: scheduledAt(recipient.channel), payloadJson: json({ member: recipient.member, letter }) });
    }
    for (const channel of campaign.channelsJson as Channel[]) if (["WEB", "SOCIAL"].includes(channel)) jobs.push({ contentId: content.id, channel, recipientKey: channel === "WEB" ? content.id : `${frozen.variants.find(row => row.channel === "SOCIAL")!.format.network}:${frozen.variants.find(row => row.channel === "SOCIAL")!.format.accountId}`, scheduledAt: scheduledAt(channel), payloadJson: json({}) });
  }
  if (jobs.length > 15000 || JSON.stringify([snapshot, jobs]).length > 20000000) throw new CreateError(422, "This frozen release is too large. Split the campaign audience or content into smaller releases.");
  const digest = fingerprint([snapshot, jobs]);
  const release = await prisma.$transaction(async tx => {
    const claimed = await tx.createCampaign.updateMany({ where: { id: campaign.id, organizationId: org, revision: campaign.revision }, data: { status: "APPROVED" } });
    if (!claimed.count) throw new CreateError(409, "Campaign content changed during review. Reload and review again.");
    for (const content of contents) for (const variant of content.variants) {
      const current = await nativeRecord(org, variant, tx);
      if (current && current.fingerprint !== variant.legacyFingerprint) throw new CreateError(409, "A native layout changed during review. Review the new version first.");
    }
    const existing = await tx.createRelease.findUnique({ where: { campaignId_campaignRevision: { campaignId: campaign.id, campaignRevision: campaign.revision } } });
    if (existing) return existing;
    const created = await tx.createRelease.create({ data: { organizationId: org, campaignId: campaign.id, campaignRevision: campaign.revision, fingerprint: digest, snapshotJson: json(snapshot), approvedBy: actor } });
    await tx.createDelivery.createMany({ data: jobs.map(job => ({ ...job, organizationId: org, releaseId: created.id, deliveryKey: fingerprint([org, created.id, job.contentId, job.channel, job.recipientKey]) })) });
    return created;
  }, { timeout: 60000 });
  res.status(201).json({ id: release.id, status: release.status, counts: prepared.plan.counts, deliveries: jobs.length });
}));
router.post("/releases/:id/release", route(async (req, res, org) => {
  const release = await prisma.createRelease.findFirst({ where: { id: param(req), organizationId: org } });
  if (!release) throw new CreateError(404, "Release not found.");
  const campaign = await assertCampaign(req, release.campaignId, true); await demandChannels(req, campaign.channelsJson as Channel[], true, true);
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  if (!settings?.oyamaCreateEnabled) throw new CreateError(422, "Enable oyamaCreate rollout after verifying organization setup before releasing deliveries.");
  if (req.body.confirm !== true) throw new CreateError(400, "Confirm that these approved deliveries may be dispatched.");
  await prisma.$transaction(async tx => {
    const locked = await tx.createCampaign.updateMany({ where: { id: campaign.id, organizationId: org, revision: release.campaignRevision, status: "APPROVED" }, data: { status: "ACTIVE" } });
    if (!locked.count) throw new CreateError(409, "The approved revision is no longer current or was already released.");
    await tx.createRelease.updateMany({ where: { id: release.id, status: "APPROVED" }, data: { status: "RELEASED" } });
    await tx.createDelivery.updateMany({ where: { organizationId: org, releaseId: release.id, status: "HELD" }, data: { status: "PENDING" } });
  }); res.json({ released: true });
}));
export default router;
