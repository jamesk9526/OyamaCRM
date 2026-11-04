import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { can, demand, demandChannels, assertCampaign, touchCampaign } from "./access.js";
import { route, param } from "./http.js";
import { CHANNELS, DELIVERY_MODES, CreateError, object, required, string, variantFrom, type Channel } from "./domain.js";
import { emailRecordAccessible, nativeChanged, parseStored, remapManagedCopy } from "./legacy.js";
import { resolvePlan } from "./audiences.js";
import { hasDefaultPermission, PERMISSION_KEYS } from "../lib/permissions.js";
const router = Router();

function campaignInput(raw: unknown) {
  const input = object(raw); const channels = Array.isArray(input.channels) ? input.channels : [];
  if (!channels.length || channels.some(channel => !CHANNELS.includes(channel as Channel)) || new Set(channels).size !== channels.length) throw new CreateError(400, "Choose one or more distinct campaign channels.");
  const objective = string(input.objective) || "GENERAL";
  if (!["FUNDRAISING", "NEWSLETTER", "EVENT", "ACKNOWLEDGMENT", "GENERAL"].includes(objective)) throw new CreateError(400, "Choose a campaign objective.");
  const mode = string(input.deliveryMode) || null;
  if (mode && !DELIVERY_MODES.includes(mode as typeof DELIVERY_MODES[number])) throw new CreateError(400, "Choose a valid email/letter delivery strategy.");
  const listIds = Array.isArray(input.audienceListIds) ? input.audienceListIds : [];
  if (listIds.length > 25 || listIds.some(id => typeof id !== "string" || id.length > 100)) throw new CreateError(400, "Choose valid saved audience lists.");
  const date = (key: string) => { if (!input[key]) return null; const result = new Date(string(input[key])); if (!Number.isFinite(result.getTime())) throw new CreateError(400, `Invalid ${key}.`); return result; };
  const startsAt = date("startsAt"), endsAt = date("endsAt");
  if (startsAt && endsAt && endsAt < startsAt) throw new CreateError(400, "The end date must follow the start date.");
  if (string(input.description).length > 10000) throw new CreateError(400, "The campaign description is too long.");
  return { name: required(input.name, "Campaign name"), objective, description: string(input.description), channelsJson: json(channels), deliveryMode: mode, audienceListIds: json(listIds), fundraisingCampaignId: string(input.fundraisingCampaignId) || null, eventId: string(input.eventId) || null, startsAt, endsAt, channels: channels as Channel[] };
}
async function validateLinks(req: Parameters<typeof demand>[0], org: string, input: ReturnType<typeof campaignInput>) {
  if (input.fundraisingCampaignId) {
    await demand(req, "edit:campaigns");
    if (!await prisma.campaign.findFirst({ where: { id: input.fundraisingCampaignId, organizationId: org } })) throw new CreateError(404, "Fundraising campaign not found.");
  }
  if (input.eventId) {
    await demand(req, "view:events");
    if (!await prisma.event.findFirst({ where: { id: input.eventId, organizationId: org } })) throw new CreateError(404, "Event not found.");
  }
  if ((input.audienceListIds as string[]).length) await resolvePlan(org, input.audienceListIds as string[], [], null, input.objective);
}

router.get("/bootstrap", route(async (req, res, org) => {
  const overrides = await prisma.userPermission.findMany({ where: { userId: req.user!.sub } });
  const permissions = PERMISSION_KEYS.filter(key => overrides.find(row => row.permission === key)?.granted ?? hasDefaultPermission(req.user!.role, key));
  if (!["view:communications", "letters.view", "view:campaigns"].some(key => permissions.includes(key as typeof permissions[number]))) throw new CreateError(403, "Communications, letters, or fundraising access is required.");
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  res.json({ enabled: settings?.oyamaCreateEnabled === true, permissions, capabilities: CHANNELS.map(channel => ({ channel, available: true, requiresConnection: ["SMS", "SOCIAL"].includes(channel), previews: channel === "EMAIL" ? ["desktop", "mobile", "plain-text"] : channel === "LETTER" ? ["pdf"] : ["content"] })) });
}));
router.put("/config", route(async (req, res, org) => {
  await demand(req, "create.connections.manage");
  if (typeof req.body?.enabled !== "boolean") throw new CreateError(400, "Choose enabled or disabled.");
  await prisma.organizationSettings.upsert({ where: { organizationId: org }, create: { organizationId: org, oyamaCreateEnabled: req.body.enabled }, update: { oyamaCreateEnabled: req.body.enabled } });
  res.json({ enabled: req.body.enabled });
}));
router.get("/campaigns", route(async (req, res, org) => {
  const allowed = await Promise.all(CHANNELS.map(async channel => ({ channel, allowed: await can(req, channel === "LETTER" ? "letters.view" : "view:communications") })));
  if (!allowed.some(item => item.allowed)) throw new CreateError(403, "Communications or letter access is required.");
  const items = await prisma.createCampaign.findMany({ where: { organizationId: org, isTemplate: req.query.templates === "true", ...(req.query.q ? { name: { contains: string(req.query.q).slice(0, 200) } } : {}) }, orderBy: { updatedAt: "desc" }, take: 101, include: { _count: { select: { contents: true, releases: true } } } });
  const funds = await can(req, "view:campaigns");
  const bindings = await prisma.createVariant.findMany({ where: { organizationId: org, channel: "EMAIL", content: { campaignId: { in: items.map(item => item.id) } }, legacyId: { not: null } }, include: { content: { select: { campaignId: true } } } });
  const emails = await prisma.emailCampaign.findMany({ where: { organizationId: org, id: { in: bindings.map(item => item.legacyId!) } } });
  const blocked = new Set(bindings.filter(item => { const email = emails.find(email => email.id === item.legacyId); return email && !emailRecordAccessible(email, req.user!.sub, req.user!.role); }).map(item => item.content.campaignId));
  res.json({ items: items.slice(0, 100).filter(item => !blocked.has(item.id) && (item.channelsJson as Channel[]).every(channel => allowed.find(entry => entry.channel === channel)?.allowed) && (!item.fundraisingCampaignId || funds)), hasMore: items.length > 100 });
}));
router.post("/campaigns", route(async (req, res, org, actor) => {
  const { channels, ...input } = campaignInput(req.body);
  await demandChannels(req, channels, true);
  if (channels.includes("LETTER")) await demand(req, "letters.create");
  await validateLinks(req, org, { ...input, channels });
  const campaign = await prisma.createCampaign.create({ data: { ...input, organizationId: org, ownerId: actor, isTemplate: req.body.isTemplate === true } });
  res.status(201).json(campaign);
}));
router.get("/campaigns/:id", route(async (req, res, org) => {
  const campaign = await assertCampaign(req, param(req));
  const contents = await prisma.createContent.findMany({ where: { campaignId: campaign.id, organizationId: org }, include: { variants: true }, orderBy: { createdAt: "asc" } });
  const items = await Promise.all(contents.map(async content => ({ ...content, variants: await Promise.all(content.variants.map(async variant => ({ ...variant, externalChanges: await nativeChanged(org, variant).catch(() => true) }))) })));
  const releases = await prisma.createRelease.findMany({ where: { campaignId: campaign.id, organizationId: org }, orderBy: { approvedAt: "desc" }, take: 20, select: { id: true, status: true, campaignRevision: true, approvedAt: true, approvedBy: true } });
  res.json({ ...campaign, contents: items, releases });
}));
router.patch("/campaigns/:id", route(async (req, res, org) => {
  const existing = await assertCampaign(req, param(req), true);
  const { channels, ...input } = campaignInput(req.body);
  await demandChannels(req, [...new Set([...(existing.channelsJson as Channel[]), ...channels])], true);
  await validateLinks(req, org, { ...input, channels });
  const campaign = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, existing.id, req.body.revision);
    const updated = await tx.createCampaign.update({ where: { id: existing.id }, data: input });
    const contents = await tx.createContent.findMany({ where: { campaignId: existing.id, organizationId: org } });
    for (const content of contents) for (const channel of channels) await tx.createVariant.upsert({ where: { contentId_channel: { contentId: content.id, channel } }, update: {}, create: { contentId: content.id, organizationId: org, channel, documentJson: json(variantFrom({ subject: content.name })) } });
    return updated;
  });
  res.json(campaign);
}));
router.post("/campaigns/:id/duplicate", route(async (req, res, org, actor) => {
  const source = await assertCampaign(req, param(req)); await demandChannels(req, source.channelsJson as Channel[], true);
  const contents = await prisma.createContent.findMany({ where: { campaignId: source.id, organizationId: org }, include: { variants: true } });
  const result = await prisma.$transaction(async tx => {
    const campaign = await tx.createCampaign.create({ data: { organizationId: org, ownerId: actor, name: required(req.body.name, "Campaign name"), objective: source.objective, description: source.description, channelsJson: json(source.channelsJson), audienceListIds: json([]), deliveryMode: source.deliveryMode, isTemplate: req.body.isTemplate === true, fundraisingCampaignId: source.fundraisingCampaignId, eventId: source.eventId } });
    for (const item of contents) {
      const content = await tx.createContent.create({ data: { campaignId: campaign.id, organizationId: org, name: item.name, documentJson: json(item.documentJson) } });
      await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: 1, documentJson: json(item.documentJson), createdBy: actor } });
      for (const variant of item.variants) {
        let legacyId: string | null = null;
        if (variant.channel === "EMAIL" && variant.legacyId) {
          const native = await tx.emailCampaign.findFirst({ where: { organizationId: org, id: variant.legacyId } });
          if (native) legacyId = (await tx.emailCampaign.create({ data: { organizationId: org, name: item.name, subject: native.subject, purpose: native.purpose, fromName: native.fromName, fromEmail: native.fromEmail, replyToEmail: native.replyToEmail, bodyHtml: native.bodyHtml, bodyText: native.bodyText, templateJson: JSON.stringify({ ...object(remapManagedCopy(parseStored(native.templateJson), item.id, content.id)), ownerId: actor, sharedWithOrganization: false }) } })).id;
        }
        if (variant.channel === "LETTER" && variant.legacyId) {
          const native = await tx.letterTemplate.findFirst({ where: { organizationId: org, id: variant.legacyId, crmScope: "DONOR" } });
          if (native) legacyId = (await tx.letterTemplate.create({ data: { organizationId: org, name: item.name, printBody: object(remapManagedCopy({ printBody: native.printBody }, item.id, content.id)).printBody as string, printSubject: native.printSubject, printLayoutJson: json(native.printLayoutJson), documentJson: json(remapManagedCopy(native.documentJson, item.id, content.id)), documentSchemaVersion: native.documentSchemaVersion, headerPresetId: native.headerPresetId, footerPresetId: native.footerPresetId, signatureBlockId: native.signatureBlockId, createdByUserId: actor } })).id;
        }
        await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel: variant.channel, documentJson: json({ ...variantFrom(variant.documentJson), scheduledAt: null }), legacyId, needsReview: !!legacyId } });
      }
    }
    return campaign;
  }); res.status(201).json(result);
}));
router.get("/audiences", route(async (req, res, org) => {
  if (!await can(req, "view:communications") && !await can(req, "letters.view")) throw new CreateError(403, "Audience access is required.");
  res.json(await prisma.emailRecipientList.findMany({ where: { organizationId: org }, select: { id: true, name: true, description: true, _count: { select: { recipients: true } } }, orderBy: { name: "asc" }, take: 500 }));
}));
export default router;
