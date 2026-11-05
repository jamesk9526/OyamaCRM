import { assertAvailableSelections } from "../trash-selection.js";
import { Router } from "express";

import { PDFDocument } from "pdf-lib";
import { prisma } from "../../lib/prisma.js";
import { json } from "../../services/letter-production.js";
import { can, demand, demandChannels, touchCampaign } from "../access.js";
import { contentFor } from "../content.js";
import { route, param } from "../http.js";
import { CreateError, documentFrom, variantFrom, string, type Channel } from "../domain.js";
import { nativeRecord, syncNative, fingerprint } from "../legacy.js";
import { importCommunication } from "../import-service.js";
import { renderChannel } from "./channel-render.js";
import { hydrateSourceHtml } from "./source-html.js";
import { defaultDesign, normalizeDesign, sourceIdentity } from "./design.js";
import { paragraph } from "./registry.js";
import { STUDIO_PRESETS, studioPreset } from "./presets.js";
import { brandForDesign, readBrand, readLegacyBrand, brandForStudio, baselineBrand } from "./brand-service.js";
import { resolveStudioDonor } from "./donor.js";
import { freezeStudioPrint, renderFrozenStudio } from "./print.js";
import type { ArtifactKind, StudioDesign } from "./types.js";
import { assertStudioAssetOwnership } from "./asset-ownership.js";
import { managedAssetIssues } from "./asset-files.js";
import { exportHtmlDocument, importHtmlDocument, type HtmlScope } from "./html-document.js";
import { renderRegion } from "./render.js";
const router = Router();

function legacyDesign(content: { documentJson: unknown }): StudioDesign {
  const design = defaultDesign(), doc = documentFrom(content.documentJson);
  design.body.content = doc.blocks.map(block => block.kind === "image" ? { type: "image", attrs: { studioId: block.id, src: block.url || "", alt: block.text, width: 100 } } : { type: block.kind === "heading" ? "heading" : "paragraph", attrs: { studioId: block.id, ...(block.kind === "heading" ? { level: 2 } : {}) }, content: block.text ? [{ type: "text", text: block.text, ...(block.kind === "link" && block.url ? { marks: [{ type: "link", attrs: { href: block.url } }] } : {}) }] : [] });
  if (!design.body.content.length) design.body.content = [paragraph("opening")]; return design;
}
router.get("/studio/presets", route(async (req, res) => { await demand(req, "letters.view"); res.json(STUDIO_PRESETS); }));
router.get("/contents/:id/studio", route(async (req, res, org) => {
  const { content, campaign } = await contentFor(req, param(req)); const state = await readBrand(org);
  const letter = content.variants.find(variant => variant.channel === "LETTER") || content.variants.find(variant => variant.channel === "EMAIL"), native = letter ? await nativeRecord(org, letter, prisma, !!content.designJson) : null;
  const legacyChanges=[];if(content.designJson)for(const variant of content.variants.filter(item=>["EMAIL","LETTER"].includes(item.channel))){const source=await nativeRecord(org,variant,prisma,true);if(source&&source.fingerprint!==variant.legacyFingerprint)legacyChanges.push({channel:variant.channel,variantRevision:variant.revision,fingerprint:source.fingerprint,html:source.kind==="EMAIL"?source.record.bodyHtml:source.record.printBody});}
  res.json({ legacyChanges, contentRevision: content.revision, campaignRevision: campaign.revision, design: content.designJson ? normalizeDesign(content.designJson) : null, proposed: legacyDesign(content), originalHtml: native?.kind === "LETTER" ? native.record.printBody : native?.kind === "EMAIL" ? native.record.bodyHtml : null, brand: content.designJson ? await brandForStudio(org, normalizeDesign(content.designJson)) : state.published?.document || state.document, latestBrandId: state.published?.id || null, studioEnabled: state.studioEnabled, canEdit: campaign.status!=="HISTORICAL" && (await Promise.all((campaign.channelsJson as Channel[]).map(channel=>can(req,channel==="LETTER"?"letters.edit":"edit:communications")))).every(Boolean), hasEmail: (campaign.channelsJson as string[]).includes("EMAIL") });
}));
router.post("/contents/:id/studio/convert", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); await demandChannels(req, campaign.channelsJson as Channel[], true);
  if(campaign.status==="HISTORICAL")throw new CreateError(409,"Historical output is preserved. Duplicate it before creating a Studio draft.");
  if (content.designJson) throw new CreateError(409, "This content already has a Studio design.");
  if (req.body.confirm !== true) throw new CreateError(400, "Review the original and confirm its Studio conversion.");
  const bound=content.variants.find(item=>item.channel==="LETTER"&&item.legacyId)||content.variants.find(item=>item.channel==="EMAIL"&&item.legacyId);
  if(bound&&!req.body.design&&!req.body.presetId){
    if(req.body.campaignRevision!==campaign.revision)throw new CreateError(409,"The campaign changed. Reload before converting its original.");
    await importCommunication(req,org,actor,bound.channel as "LETTER"|"EMAIL",bound.legacyId!);
    const refreshed=await prisma.createContent.findUniqueOrThrow({where:{id:content.id}}),current=await prisma.createCampaign.findUniqueOrThrow({where:{id:campaign.id}}),design=normalizeDesign(refreshed.designJson);
    res.json({design,contentRevision:refreshed.revision,campaignRevision:current.revision,brand:await brandForStudio(org,design)});return;
  }
  const missingLetter=content.variants.find(item=>item.channel==="LETTER");if(missingLetter&&!missingLetter.legacyId)await demand(req,"letters.create");
  const originalVariant=content.variants.find(item=>item.channel==="LETTER"),original=originalVariant?await nativeRecord(org,originalVariant):null;
  const design = req.body.design ? normalizeDesign(req.body.design) : req.body.presetId ? studioPreset(string(req.body.presetId)) : legacyDesign(content);
  const emailVersion=content.variants.find(item=>item.channel==="EMAIL");if(!design.email.subject)design.email.subject=emailVersion?variantFrom(emailVersion.documentJson).subject||content.name:content.name;
  assertStudioAssetOwnership(org,design);
  await assertAvailableSelections(org, design);
  design.brandRevisionId = await baselineBrand(org, actor);
  if (!req.body.design && !req.body.presetId) {
    const variant = content.variants.find(item => item.channel === "LETTER"), native = variant ? await nativeRecord(org, variant) : null;
    if (native?.kind === "LETTER" && native.record.printBody.trim()) design.body.content = [{ type: "studioLegacy", attrs: { studioId: "preserved-original", html: native.record.printBody } }];
  }
  await prisma.$transaction(async tx => { await touchCampaign(tx, org, campaign.id, req.body.campaignRevision); const letter = content.variants.find(variant => variant.channel === "LETTER"); if (letter && !letter.legacyId) await syncNative(tx, org, actor, content, letter); await tx.createDocumentRevision.upsert({ where: { contentId_revision: { contentId: content.id, revision: content.revision } }, update: {}, create: { organizationId: org, contentId: content.id, revision: content.revision, documentJson: json({ shared: content.documentJson, legacy: true, ...(original?.kind==="LETTER"?{originalLetter:{html:original.record.printBody,subject:original.record.printSubject,templateId:original.record.id}}:{}) }), createdBy: actor } }); await tx.createContent.update({ where: { id: content.id }, data: { designJson: json(design), revision: { increment: 1 } } }); await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: content.revision + 1, documentJson: json({ shared: content.documentJson, studio: design }), createdBy: actor } }); });
  res.json({ design, contentRevision: content.revision + 1, campaignRevision: campaign.revision + 1, brand: await brandForDesign(org, design.brandRevisionId) });
}));
router.patch("/contents/:id/studio", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true); await demandChannels(req, campaign.channelsJson as Channel[], true);
  if(campaign.status==="HISTORICAL")throw new CreateError(409,"Historical output is preserved. Duplicate it before editing.");
  if (!content.designJson) throw new CreateError(409, "Review the original content before converting it to Studio.");
  const design = normalizeDesign(req.body.design); assertStudioAssetOwnership(org,design); await assertAvailableSelections(org, design, content.designJson); await brandForStudio(org, design);
  await hydrateSourceHtml(req, org, design);
  if (!design.brandRevisionId && !design.presentation?.sourceRevisionId) throw new CreateError(400, "Select a preserved brand revision.");
  const old = normalizeDesign(content.designJson); if (design.email.reviewedSource && design.email.reviewedSource !== old.email.reviewedSource && design.email.reviewedSource !== sourceIdentity(design)) throw new CreateError(400, "Review the current shared design before accepting email customizations.");
  const result = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
    if(req.body.sourceMode==="HTML")await tx.createDocumentRevision.upsert({where:{contentId_revision:{contentId:content.id,revision:content.revision}},update:{},create:{organizationId:org,contentId:content.id,revision:content.revision,documentJson:json({shared:content.documentJson,studio:old}),createdBy:actor}});
    const updated = await tx.createContent.updateMany({ where: { id: content.id, organizationId: org, revision: req.body.revision }, data: { designJson: json(design), revision: { increment: 1 } } });
    if (!updated.count) throw new CreateError(409, "This design changed in another session. Your local draft remains available.");
    await tx.createVariant.updateMany({ where: { contentId: content.id, organizationId: org, channel: { in: ["WEB", "SMS", "SOCIAL"] } }, data: { needsReview: true } });
    for (const channel of ["WEB","SMS","SOCIAL"] as const) if (design.channels?.[channel]?.reviewedSource === sourceIdentity(design)) await tx.createVariant.updateMany({where:{contentId:content.id,organizationId:org,channel},data:{needsReview:false}});
    await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: content.revision + 1, documentJson: json({ shared: content.documentJson, studio: design }), createdBy: actor } });
    return { design, contentRevision: content.revision + 1, campaignRevision: campaign.revision + 1 };
  }); res.json(result);
}));
router.post("/contents/:id/studio/html",route(async(req,res,org)=>{
  const {content,campaign}=await contentFor(req,param(req));
  if(!content.designJson)throw new CreateError(409,"Open this content in Studio before editing its HTML.");
  const action=string(req.body.action),scope=(string(req.body.scope)||"SHARED") as HtmlScope;
  if(!["SHARED","LETTER","EMAIL","WEB","SOCIAL","SMS"].includes(scope)||!["EXPORT","CONVERT"].includes(action))throw new CreateError(400,"Choose a supported HTML action and document scope.");
  const design=normalizeDesign(content.designJson);
  if(scope!=="SHARED"&&!design.channels?.[scope])throw new CreateError(400,"Customize this channel explicitly before editing its HTML.");
  const hydrated=await hydrateSourceHtml(req,org,design),brand=await brandForStudio(org,design,scope==="SHARED"?undefined:scope),identity=fingerprint(content.designJson);
  if(action==="EXPORT"){res.json({html:exportHtmlDocument(design,brand,scope,hydrated),revision:content.revision,fingerprint:identity,scope});return;}
  await demandChannels(req,campaign.channelsJson as Channel[],true);
  if(campaign.status==="HISTORICAL")throw new CreateError(409,"Use historical content as a new draft before editing HTML.");
  if(req.body.revision!==content.revision||req.body.fingerprint!==identity)throw new CreateError(409,"This design changed after HTML mode opened. Your HTML is retained; download it before reopening the latest design.");
  const result=importHtmlDocument(design,brand,string(req.body.html),scope,hydrated);assertStudioAssetOwnership(org,result.design);
  await assertAvailableSelections(org,result.design,content.designJson);
  res.json(result);
}));
router.post("/contents/:id/studio/preview", route(async (req, res, org) => {
  const {content,campaign}=await contentFor(req,param(req));
  const channel=string(req.body.channel)||"LETTER";if(!["LETTER","EMAIL","WEB","SMS","SOCIAL"].includes(channel))throw new CreateError(400,"Choose a supported preview channel.");
  await demandChannels(req,[channel as Channel]);
  const design=await hydrateSourceHtml(req,org,normalizeDesign(req.body.design||content.designJson)),brand=await brandForStudio(org,design,channel as Channel);
  const donor=await resolveStudioDonor(req,campaign,design,["LETTER","EMAIL"].includes(channel)?string(req.body.constituentId)||undefined:undefined);
  const variant=content.variants.find(item=>item.channel===channel),format=variantFrom(req.body.format||variant?.documentJson);
  const artifact=string(req.body.artifact)||"LETTER";if(!["LETTER","REPLY_SLIP","OUTER_ENVELOPE","RETURN_ENVELOPE"].includes(artifact))throw new CreateError(400,"Choose a supported appeal-pack piece.");
  const result=renderChannel(design,donor,brand,channel as Channel,format,artifact as ArtifactKind);
  result.issues.push(...await managedAssetIssues(org,result.html));
  res.json({...result,donor,brand,contentRevision:content.revision,channel,...(channel==="LETTER"&&!["OUTER_ENVELOPE","RETURN_ENVELOPE"].includes(artifact)?{pageChrome:{header:renderRegion(design,donor,brand,"firstHeader"),footer:renderRegion(design,donor,brand,"firstFooter")}}:{})});
}));
router.post("/contents/:id/studio/legacy-review",route(async(req,res,org,actor)=>{
  const {content,campaign}=await contentFor(req,param(req),true);if(!content.designJson||req.body.confirm!==true)throw new CreateError(400,"Review the preserved legacy output against Studio first.");
  const channel=string(req.body.channel),variant=content.variants.find(item=>item.channel===channel);if(!variant||!["EMAIL","LETTER"].includes(channel))throw new CreateError(404,"Legacy version not found.");await demandChannels(req,[channel as Channel],true);
  await prisma.$transaction(async tx=>{await touchCampaign(tx,org,campaign.id,req.body.campaignRevision);const source=await nativeRecord(org,variant,tx);if(!source||source.fingerprint!==req.body.fingerprint||req.body.variantRevision!==variant.revision)throw new CreateError(409,"The legacy version changed again. Compare its current output before continuing.");const changed=await tx.createVariant.updateMany({where:{id:variant.id,revision:variant.revision},data:{legacyFingerprint:source.fingerprint,needsReview:false,revision:{increment:1}}});if(!changed.count)throw new CreateError(409,"The legacy version changed in another session.");await tx.auditLog.create({data:{organizationId:org,userId:actor,action:"CREATE_STUDIO_LEGACY_REVIEWED",entity:"CreateContent",entityId:content.id,metadata:{channel,choice:"KEEP_STUDIO",fingerprint:source.fingerprint}}});});
  res.json({reviewed:true,campaignRevision:campaign.revision+1});
}));
router.get("/studio/recipients", route(async (req, res, org) => {
  await demand(req, "view:constituents"); const q = string(req.query.q).slice(0, 100);
  res.json(await prisma.constituent.findMany({ where: { organizationId: org, ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { organizationName: { contains: q } }] } : {}) }, select: { id: true, firstName: true, lastName: true, displayName: true, organizationName: true }, orderBy: { lastName: "asc" }, take: 50 }));
}));
router.get("/studio/recipients/:id/gifts", route(async (req, res, org) => {
  await demand(req, "view:constituents"); await demand(req, "letters.view_sensitive_merge_data");
  if (!await prisma.constituent.findFirst({ where: { id: param(req), organizationId: org } })) throw new CreateError(404, "Recipient not found.");
  res.json(await prisma.donation.findMany({ where: { constituentId: param(req), constituent: { organizationId: org }, status: "COMPLETED" }, select: { id: true, amount: true, date: true, receiptNumber: true }, orderBy: { date: "desc" }, take: 100 }));
}));
router.post("/contents/:id/studio/proof", route(async (req, res, org) => {
  const { content, campaign } = await contentFor(req, param(req)); await demand(req, "letters.export_pdf");
  if (req.body.revision !== content.revision) throw new CreateError(409, "Save and refresh the current design before generating its proof.");
  const design = await hydrateSourceHtml(req,org,normalizeDesign(content.designJson)), brand = await brandForStudio(org, design), donor = await resolveStudioDonor(req, campaign, design, string(req.body.constituentId) || undefined), kinds: ArtifactKind[] = ["LETTER"];
  if (design.pack.replySlip.enabled && design.pack.replySlip.placement === "separate") kinds.push("REPLY_SLIP"); if (design.pack.outerEnvelope.enabled) kinds.push("OUTER_ENVELOPE"); if (design.pack.returnEnvelope.enabled) kinds.push("RETURN_ENVELOPE");
  const requested = string(req.body.kind); if (requested && requested !== "ALL" && !kinds.includes(requested as ArtifactKind)) throw new CreateError(400, "This appeal pack does not include that piece.");
  const output = await PDFDocument.create(); const manifest = [];
  for (const kind of requested && requested !== "ALL" ? [requested as ArtifactKind] : kinds) { const snapshot = await freezeStudioPrint(org, design, donor, brand, kind, true), rendered = await renderFrozenStudio(snapshot, true), part = await PDFDocument.load(rendered.bytes); const start = output.getPageCount() + 1; for (const page of await output.copyPages(part, part.getPageIndices())) output.addPage(page); manifest.push({ kind, startPage: start, pages: rendered.pageCount, recipientId: donor.constituentId, revision: content.revision }); }
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=studio-appeal-proof.pdf", "X-Studio-Manifest": JSON.stringify(manifest), "X-Content-Type-Options": "nosniff" }).send(Buffer.from(await output.save()));
}));
export default router;
