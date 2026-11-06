import { trashedIds, isTrashed } from "./trash-state.js";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { can, demand, demandChannels, assertCampaign, touchCampaign } from "./access.js";
import { route, param } from "./http.js";
import { CHANNELS, DELIVERY_MODES, CreateError, object, required, string, variantFrom, type Channel } from "./domain.js";
import { emailRecordAccessible, nativeChanged, parseStored, remapManagedCopy, nativeRecord } from "./legacy.js";
import { resolvePlan } from "./audiences.js";
import { hasDefaultPermission, PERMISSION_KEYS } from "../lib/permissions.js";
import { convertLegacy } from "./studio/conversion.js";
import { normalizeDesign } from "./studio/design.js";
import { copyStudioSources } from "./studio/copy-sources.js";
import { classicConfig, classicWorkingCopy } from "./classic-letter.js";
import { readLetterAdaptation } from "./letter-adaptations.js";
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
  res.json({ enabled: settings?.oyamaCreateEnabled === true, studioEnabled: settings?.oyamaCreateStudioEnabled === true, shellEnabled: settings?.oyamaCreateV5ShellEnabled === true, unifiedEditorEnabled: settings?.oyamaCreateUnifiedEditorEnabled === true, classicLettersEnabled: settings?.oyamaCreateClassicLettersEnabled === true, brandHubEnabled: settings?.oyamaCreateBrandHubEnabled === true, permissions, capabilities: CHANNELS.map(channel => ({ channel, available: true, requiresConnection: ["SMS", "SOCIAL"].includes(channel), previews: channel === "EMAIL" ? ["desktop", "mobile", "plain-text"] : channel === "LETTER" ? ["pdf"] : ["content"] })) });
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
  let after:{date:Date;id:string}|null=null;
  if(req.query.after){try{const parsed=JSON.parse(Buffer.from(string(req.query.after),"base64url").toString());after={date:new Date(parsed.date),id:String(parsed.id)};if(!Number.isFinite(after.date.getTime())||after.id.length>191)throw new Error();}catch{throw new CreateError(400,"The campaign page cursor is invalid.");}}
  const items = await prisma.createCampaign.findMany({ where: { organizationId: org, id: { notIn: await trashedIds(org, "CAMPAIGN") }, isTemplate: req.query.templates === "true", ...(req.query.status?{status:string(req.query.status)}:{}), ...(req.query.q ? { name: { contains: string(req.query.q).slice(0, 200) } } : {}),...(after?{OR:[{updatedAt:{lt:after.date}},{updatedAt:after.date,id:{lt:after.id}}]}:{}) }, orderBy: [{updatedAt:"desc"},{id:"desc"}], take: 101, include: { _count: { select: { contents: true, releases: true } } } });
  const funds = await can(req, "view:campaigns");
  const bindings = await prisma.createVariant.findMany({ where: { organizationId: org, channel: "EMAIL", content: { campaignId: { in: items.map(item => item.id) } }, legacyId: { not: null } }, include: { content: { select: { campaignId: true } } } });
  const emails = await prisma.emailCampaign.findMany({ where: { organizationId: org, id: { in: bindings.map(item => item.legacyId!) } } });
  const blocked = new Set(bindings.filter(item => { const email = emails.find(email => email.id === item.legacyId); return email && !emailRecordAccessible(email, req.user!.sub, req.user!.role); }).map(item => item.content.campaignId));
  const imported=await prisma.createImportSource.findMany({where:{organizationId:org,campaignId:{in:items.map(item=>item.id)}}});
  for(const source of imported)if(source.campaignId&&source.ownerId&&source.ownerId!==req.user!.sub&&req.user!.role!=="admin"&&!source.shared&&!(source.sourceType==="EMAIL"&&emails.some(email=>email.id===source.sourceId)))blocked.add(source.campaignId);
  const last=items[99];
  res.json({ items: items.slice(0, 100).filter(item => !blocked.has(item.id) && (item.channelsJson as Channel[]).every(channel => allowed.find(entry => entry.channel === channel)?.allowed) && (!item.fundraisingCampaignId || funds)), hasMore: items.length > 100,nextCursor:items.length>100&&last?Buffer.from(JSON.stringify({date:last.updatedAt.toISOString(),id:last.id})).toString("base64url"):null });
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
  const items = await Promise.all(contents.map(async content => {
    const letter = content.variants.some(variant => variant.channel === "LETTER") ? await classicWorkingCopy(org, content.id) : null;
    return { ...content, classicLetter: !!letter, variants: await Promise.all(content.variants.map(async ({ letterAdaptationJson, ...variant }) => {
      const adaptation = readLetterAdaptation(letterAdaptationJson);
      return { ...variant, letterLinked: !!adaptation, letterUpdateAvailable: !!adaptation && !!letter && adaptation.letterRevision !== letter.revision, externalChanges: await nativeChanged(org, variant).catch(() => true) };
    })) };
  }));
  const releases = await prisma.createRelease.findMany({ where: { campaignId: campaign.id, organizationId: org }, orderBy: { approvedAt: "desc" }, take: 20, select: { id: true, status: true, campaignRevision: true, approvedAt: true, approvedBy: true } });
  res.json({ ...campaign, ...(await isTrashed(org, "CAMPAIGN", campaign.id) ? { trashed: true, status: "HISTORICAL" } : {}), contents: items, releases });
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
  if((source.channelsJson as string[]).includes("LETTER"))await demand(req,"letters.create");
  const contents = await prisma.createContent.findMany({ where: { campaignId: source.id, organizationId: org }, include: { variants: true } });
  const result = await prisma.$transaction(async tx => {
    const campaign = await tx.createCampaign.create({ data: { organizationId: org, ownerId: actor, name: required(req.body.name, "Campaign name"), objective: source.objective, description: source.description, channelsJson: json(source.channelsJson), audienceListIds: json([]), deliveryMode: source.deliveryMode, isTemplate: req.body.isTemplate === true, fundraisingCampaignId: source.fundraisingCampaignId, eventId: source.eventId } });
    for (const item of contents) {
      const working = item.variants.some(variant => variant.channel === "LETTER") ? await classicWorkingCopy(org, item.id, tx) : null;
      const design = item.designJson ? normalizeDesign(item.designJson) : null;
      if(design){design.data.giftSelections={};design.email.reviewedSource=null;}
      const content = await tx.createContent.create({ data: { campaignId: campaign.id, organizationId: org, name: item.name, documentJson: json(item.documentJson), ...(design?{designJson:json(design)}:{}) } });
      const classicCopy = working ? {
        config: { ...classicConfig(working), settings: { ...classicConfig(working).settings, giftSelections: undefined }, reviewed: false, diagnostics: ["Review the recipient proof for this copied Letter."] },
        template: { name: item.name, printBody: working.printBody, printSubject: working.printSubject, printLayoutJson: working.printLayoutJson },
      } : null;
      if (working && classicCopy) await tx.letterTemplate.create({ data: {
        organizationId: org, createContentId: content.id, revision: 1, createdByUserId: actor, name: item.name,
        description: working.description, category: working.category, printBody: working.printBody, printSubject: working.printSubject,
        emailBody: working.emailBody, emailSubject: working.emailSubject, printLayoutJson: json(working.printLayoutJson), documentJson: json(classicCopy.config),
      } });
      await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: 1, documentJson: json(classicCopy ? { shared: item.documentJson, studio: design, classicLetter: classicCopy } : item.documentJson), createdBy: actor } });
      let convertedCopy=design;
      for (const variant of item.variants) {
        let legacyId: string | null = null;
        if (variant.channel === "EMAIL" && variant.legacyId) {
          const native = await tx.emailCampaign.findFirst({ where: { organizationId: org, id: variant.legacyId } });
          if (native) legacyId = (await tx.emailCampaign.create({ data: { organizationId: org, name: item.name, subject: native.subject, purpose: native.purpose, fromName: native.fromName, fromEmail: native.fromEmail, replyToEmail: native.replyToEmail, bodyHtml: native.bodyHtml, bodyText: native.bodyText, templateJson: JSON.stringify({ ...object(remapManagedCopy(parseStored(native.templateJson), item.id, content.id)), ownerId: actor, sharedWithOrganization: false }) } })).id;
        }
        if (variant.channel === "LETTER" && variant.legacyId && !working) {
          const native = await tx.letterTemplate.findFirst({ where: { organizationId: org, id: variant.legacyId, crmScope: "DONOR" } });
          if (native) legacyId = (await tx.letterTemplate.create({ data: { organizationId: org, name: item.name, printBody: object(remapManagedCopy({ printBody: native.printBody }, item.id, content.id)).printBody as string, printSubject: native.printSubject, printLayoutJson: json(native.printLayoutJson), documentJson: json(remapManagedCopy(native.documentJson, item.id, content.id)), documentSchemaVersion: native.documentSchemaVersion, headerPresetId: native.headerPresetId, footerPresetId: native.footerPresetId, signatureBlockId: native.signatureBlockId, createdByUserId: actor } })).id;
        }
        if(variant.channel==="LETTER"&&!legacyId&&design&&!working)legacyId=(await tx.letterTemplate.create({data:{organizationId:org,name:item.name,printBody:"",createdByUserId:actor,crmScope:"DONOR"}})).id;
        const nativeCopy=legacyId?await nativeRecord(org,{channel:variant.channel,legacyId},tx):null;
        if(!convertedCopy&&nativeCopy){
          const originalSource=await tx.createImportSource.findFirst({where:{organizationId:org,sourceId:variant.legacyId!,sourceType:variant.channel}});
          const revision=originalSource?await tx.createImportSourceRevision.findFirst({where:{sourceId:originalSource.id,fingerprint:originalSource.acceptedFingerprint||originalSource.fingerprint||""}}):null;
          const conversion=convertLegacy(nativeCopy.record,nativeCopy.kind,revision?.id||"");convertedCopy=conversion.design;
          if(revision)convertedCopy.presentation={...convertedCopy.presentation,sourceRevisionId:revision.id};
        }
        const adaptation = working ? readLetterAdaptation(variant.letterAdaptationJson) : null;
        await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel: variant.channel, documentJson: json({ ...variantFrom(variant.documentJson), scheduledAt: null }), legacyId, legacyFingerprint:nativeCopy?.fingerprint||null, needsReview: !!legacyId,
          ...(adaptation ? { letterAdaptationJson: json({ ...adaptation, letterRevision: adaptation.letterRevision === working?.revision ? 1 : 0 }) } : {}) } });
      }
      if(convertedCopy){await copyStudioSources(req,tx,org,actor,campaign.id,content.id,convertedCopy);await tx.createContent.update({where:{id:content.id},data:{designJson:json(convertedCopy)}});await tx.createDocumentRevision.updateMany({where:{contentId:content.id,revision:1},data:{documentJson:json({shared:content.documentJson,studio:convertedCopy,...(classicCopy?{classicLetter:classicCopy}:{})})}});}
    }
    return campaign;
  }); res.status(201).json(result);
}));
router.get("/audiences", route(async (req, res, org) => {
  if (!await can(req, "view:communications") && !await can(req, "letters.view")) throw new CreateError(403, "Audience access is required.");
  res.json(await prisma.emailRecipientList.findMany({ where: { organizationId: org }, select: { id: true, name: true, description: true, _count: { select: { recipients: true } } }, orderBy: { name: "asc" }, take: 500 }));
}));
export default router;
