import { Router } from "express";
import { classicWorkingCopy } from "./classic-letter.js";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { route, param } from "./http.js";
import { can, assertCampaign, demand, demandChannels, touchCampaign } from "./access.js";
import { CreateError, object, string } from "./domain.js";
import { demandImportAdmin, ensureImport, inventory, sourceAccess, reconcileSource, importCommunication } from "./import-service.js";
import { emailRecordAccessible, nativeRecord } from "./legacy.js";
import { convertLegacy } from "./studio/conversion.js";
import type { EmailCampaign, LetterTemplate } from "@prisma/client";
import { fingerprint } from "./legacy.js";
import { readLegacyBrand, sanitizeBrandHtml } from "./studio/brand-service.js";
import { assertStudioAssetOwnership } from "./studio/asset-ownership.js";
import { normalizeDesign, walkNodes } from "./studio/design.js";
import { sourceRevisionFor } from "./studio/source-html.js";
import { sanitizeStudioHtml } from "./studio/html.js";
const router=Router();
router.get("/imports/inventory",route(async(req,res,org)=>{await demandImportAdmin(req);res.json(await inventory(org));}));
router.post("/imports/ensure",route(async(req,res)=>res.json(await ensureImport(req))));
router.get("/imports",route(async(req,res,org)=>{await demandImportAdmin(req);res.json({run:await prisma.createImportRun.findUnique({where:{organizationId:org}}),inventory:await inventory(org)});}));
router.post("/imports/control",route(async(req,res,org)=>{
  await demandImportAdmin(req);const action=string(req.body.action);if(!["PAUSE","RESUME","RESCAN","RETRY"].includes(action))throw new CreateError(400,"Choose pause, resume, rescan or retry.");
  const run=await ensureImport(req);
  res.json(await prisma.createImportRun.update({where:{id:run.id},data:{status:action==="PAUSE"?"PAUSED":"RUNNING",actorId:req.user!.sub,lastError:null,leaseToken:null,leaseUntil:null,...(action==="PAUSE"?{}:{nextScanAt:new Date(),...(action==="RESCAN"||action==="RETRY"?{cursorJson:json({phase:0,after:""})}:{})})}}));
  await prisma.auditLog.create({data:{organizationId:org,userId:req.user!.sub,action:`CREATE_IMPORT_${action}`,entity:"CreateImportRun",entityId:run.id}});
}));
router.get("/imports/sources",route(async(req,res,org,actor)=>{
  const email=await can(req,"view:communications"),letter=await can(req,"letters.view");if(!email&&!letter)throw new CreateError(403,"Communications access is required.");
  const limit=Math.max(1,Math.min(100,Number(req.query.limit)||40)),type=string(req.query.type),q=string(req.query.q).slice(0,191),status=string(req.query.status);
  const allowed=[...(email?["EMAIL","BROWSER_SECTION","BROWSER_DRAFT"]:[]),...(letter?["LETTER","GENERATED_LETTER","BROWSER_LETTER"]:[]),"HEADER","FOOTER","SIGNATURE","ASSET"];
  // Source ownership is snapshotted, but current native email restrictions remain authoritative.
  const nativeEmails=email&&req.user!.role!=="admin"?await prisma.emailCampaign.findMany({where:{organizationId:org},select:{id:true,templateJson:true,audienceFilter:true}}):[];
  const privateIds=nativeEmails.filter(item=>!emailRecordAccessible(item,actor,req.user!.role)).map(item=>item.id);
  const where={organizationId:org,...(privateIds.length?{NOT:{sourceType:"EMAIL",sourceId:{in:privateIds}}}:{}),sourceType:type?{in:allowed.filter(item=>item===type)}:{in:allowed},...(q?{name:{contains:q}}:{}),...(status?{status}:{}),...(req.query.contentId?{contentId:string(req.query.contentId)}:{}),...(req.user!.role==="admin"?{}:{OR:[{ownerId:null},{ownerId:actor},{shared:true}]})};
  const cursor=string(req.query.after);const rows=await prisma.createImportSource.findMany({where:{...where,...(cursor?{id:{gt:cursor}}:{})},orderBy:{id:"asc"},take:limit+1});
  res.json({items:rows.slice(0,limit),hasMore:rows.length>limit,nextCursor:rows.length>limit?rows[limit-1].id:null,total:await prisma.createImportSource.count({where})});
}));
async function accessibleSource(req:Parameters<typeof can>[0],org:string,id:string,manage=false){
  const source=await prisma.createImportSource.findFirst({where:{id,organizationId:org}});if(!source)throw new CreateError(404,"Imported source not found.");
  if(!sourceAccess(req,source,manage))throw new CreateError(403,"This source belongs to another staff member.");
  if(["HEADER","FOOTER","SIGNATURE","ASSET"].includes(source.sourceType)){if(!await can(req,"letters.view")&&!await can(req,"view:communications"))throw new CreateError(403,"Library access is required.");}
  else await demandChannels(req,[source.sourceType.endsWith("LETTER")?"LETTER":"EMAIL"],manage);
  if(source.sourceType.includes("GENERATED_LETTER")&&!await can(req,"letters.view_sensitive_merge_data"))throw new CreateError(403,"Sensitive donor-data permission is required for generated history.");
  if(source.sourceType==="EMAIL"){
    const email=await prisma.emailCampaign.findFirst({where:{id:source.sourceId,organizationId:org}});
    if(email&&!emailRecordAccessible(email,req.user!.sub,req.user!.role,manage))throw new CreateError(403,"The source email's sharing permissions changed.");
  }
  return source;
}
router.get("/imports/sources/:id",route(async(req,res,org)=>{
  const source=await accessibleSource(req,org,param(req));
  const after=string(req.query.after),rows=await prisma.createImportSourceRevision.findMany({where:{sourceId:source.id,...(after?{id:{lt:after}}:{})},orderBy:{id:"desc"},take:51});
  const currentRevision=source.fingerprint?await prisma.createImportSourceRevision.findFirst({where:{sourceId:source.id,fingerprint:source.fingerprint}}):null;
  const deliveryAfter=string(req.query.deliveryAfter);
  const recipients=source.sourceType==="EMAIL"?await prisma.emailSendRecipient.findMany({where:{organizationId:org,campaignId:source.sourceId,...(deliveryAfter?{id:{gt:deliveryAfter}}:{})},orderBy:{id:"asc"},take:101,include:{deliveryEvents:{orderBy:{eventAt:"desc"},take:1}}}):[];
  res.json({source,currentRevision,revisions:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null,deliveryRecords:recipients.slice(0,100).map(item=>({id:item.id,email:item.email,status:item.deliveryEvents?.[0]?.eventType||(item.sentAt?"SENT":item.eligibilityStatus),error:item.ineligibilityReason})),nextDeliveryCursor:recipients.length>100?recipients[99].id:null});
}));
router.post("/imports/sources/:id/reconcile",route(async(req,res,org)=>{
  const source=await accessibleSource(req,org,param(req),true),choice=string(req.body.choice);
  if(!["KEEP_CREATE","USE_SOURCE"].includes(choice)||req.body.confirm!==true||req.body.fingerprint!==source.fingerprint)throw new CreateError(409,"Refresh the comparison and confirm your choice.");
  await reconcileSource(req,source,choice as "KEEP_CREATE"|"USE_SOURCE",req.body.campaignRevision,req.body.contentRevision);res.json({reviewed:true});
}));
router.post("/imports/sources/:id/use",route(async(req,res,org,actor)=>{
  const source=await accessibleSource(req,org,param(req),true);
  if(source.sourceType==="EMAIL"||source.sourceType==="LETTER"){
    const result=await importCommunication(req,org,actor,source.sourceType,source.sourceId);res.json(result);return;
  }
  if(source.sourceType==="GENERATED_LETTER"){
    const generated=await prisma.generatedLetter.findFirst({where:{id:source.sourceId,organizationId:org}});
    if(!generated)throw new CreateError(404,"The original generated letter is unavailable.");
    res.json(await importCommunication(req,org,actor,"LETTER",generated.templateId));return;
  }
  throw new CreateError(400,"Open this resource from the library or use its source template.");
}));
router.post("/imports/sources/:id/review",route(async(req,res,org,actor)=>{
  const source=await accessibleSource(req,org,param(req),true);
  if(req.body.confirm!==true||source.fingerprint!==req.body.fingerprint||!source.contentId||!source.campaignId)throw new CreateError(409,"Refresh and compare the original conversion first.");
  const campaign = await assertCampaign(req,source.campaignId,true);
  const content=await prisma.createContent.findFirst({where:{id:source.contentId,organizationId:org}});
  const working = source.sourceType === "LETTER" && content ? await classicWorkingCopy(org, content.id) : null;
  if (working && content) {
    if (campaign.status !== "DRAFT" || content.revision !== req.body.contentRevision) throw new CreateError(409, "Review the current draft Letter before accepting its source.");
    await demand(req, "letters.edit");
    await prisma.$transaction(async tx => {
      await touchCampaign(tx, org, campaign.id, req.body.campaignRevision);
      await tx.createImportSource.update({ where: { id: source.id }, data: { status: "CONVERTED", acceptedFingerprint: source.fingerprint } });
      await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_CONVERSION_REVIEWED", entity: "CreateImportSource", entityId: source.id, metadata: { fingerprint: source.fingerprint, contentRevision: content.revision } } });
    });
    res.json({ reviewed: true }); return;
  }
  if(!content?.designJson||content.revision!==req.body.contentRevision)throw new CreateError(409,"The draft changed. Compare the current conversion again.");
  const design=normalizeDesign(content.designJson);
  for(const node of [design.body,...Object.values(design.channels||{}).map(item=>item.document)].flatMap(walkNodes))if(node.type==="studioHtml"&&node.attrs){node.attrs.html=sanitizeStudioHtml(string(node.attrs.html));node.attrs.reviewedHtml=node.attrs.sourceRevisionId||node.attrs.html;}
  await prisma.$transaction(async tx=>{
    await touchCampaign(tx,org,source.campaignId!,req.body.campaignRevision);
    const changed=await tx.createContent.updateMany({where:{id:content.id,organizationId:org,revision:content.revision},data:{designJson:json(design),revision:{increment:1}}});if(!changed.count)throw new CreateError(409,"The draft changed while reviewing it.");
    await tx.createDocumentRevision.create({data:{organizationId:org,contentId:content.id,revision:content.revision+1,documentJson:json({shared:content.documentJson,studio:design}),createdBy:actor}});
    await tx.createImportSource.update({where:{id:source.id},data:{status:"CONVERTED",acceptedFingerprint:source.fingerprint}});
    await tx.auditLog.create({data:{organizationId:org,userId:actor,action:"CREATE_CONVERSION_REVIEWED",entity:"CreateImportSource",entityId:source.id,metadata:{fingerprint:source.fingerprint,contentRevision:content.revision}}});
  });res.json({reviewed:true});
}));
router.get("/imports/revisions/:id",route(async(req,res,org)=>{
  const revision=await sourceRevisionFor(req,org,param(req));await accessibleSource(req,org,revision.sourceId);
  res.json({id:revision.id,html:string(object(revision.snapshotJson).originalHtml),source:revision.source});
}));
router.post("/imports/revisions/:id/html",route(async(req,res,org)=>{
  const revision=await sourceRevisionFor(req,org,param(req));await accessibleSource(req,org,revision.sourceId,true);
  const html=string(req.body.html);if(html.length>2000000)throw new CreateError(400,"Preserved HTML must be under 2 MB.");
  const safe=sanitizeStudioHtml(html);assertStudioAssetOwnership(org,{html:safe});
  const hash=fingerprint([revision.id,safe]);
  const next=await prisma.createImportSourceRevision.upsert({where:{sourceId_fingerprint:{sourceId:revision.sourceId,fingerprint:hash}},update:{},create:{sourceId:revision.sourceId,fingerprint:hash,snapshotJson:json({...object(revision.snapshotJson),originalHtml:safe,kind:"HTML_EDIT",parentRevisionId:revision.id})}});
  res.status(201).json({id:next.id,html:safe});
}));
router.post("/imports/recover",route(async(req,res,org,actor)=>{
  if(req.body.confirm!==true||req.body.organizationId!==org)throw new CreateError(400,"Confirm the destination organization for browser recovery.");
  const kind=string(req.body.kind),name=string(req.body.name).trim().slice(0,191);
  if(!["SECTION","DRAFT"].includes(kind)||!name)throw new CreateError(400,"Choose a valid browser recovery item.");
  const raw=object(req.body.record);if(JSON.stringify(raw).length>2000000)throw new CreateError(400,"This browser item is too large; recover a smaller section.");
  const channel=kind==="DRAFT"&&typeof raw.printBody==="string"?"LETTER":"EMAIL";
  await demandChannels(req,[channel],true);
  if(channel==="LETTER"){
    if(!await can(req,"letters.create"))throw new CreateError(403,"Letter creation permission is required for recovery.");
    const original=string(raw._legacyTemplateId)?await prisma.letterTemplate.findFirst({where:{id:string(raw._legacyTemplateId),organizationId:org}}):null;
    if(raw.crmScope==="CLINICAL"||original&&original.crmScope!=="DONOR")throw new CreateError(400,"Clinical records are excluded from Create recovery.");
  }
  const sourceId=`${actor}:${fingerprint([kind,raw])}`,sourceType=kind==="SECTION"?"BROWSER_SECTION":channel==="LETTER"?"BROWSER_LETTER":"BROWSER_DRAFT",hash=fingerprint(raw);
  const existing=await prisma.createImportSource.findUnique({where:{organizationId_sourceType_sourceId:{organizationId:org,sourceType,sourceId}}});
  if(existing){res.json({recovered:true,campaignId:existing.campaignId,sourceId:existing.id});return;}
  const email={name,subject:string(raw.emailSubject||raw.printSubject||name),bodyHtml:string(raw.printBody||raw.bodyHtml),previewText:null,templateJson:JSON.stringify({template:kind==="SECTION"?{blocks:[raw.block||raw]}:undefined})} as EmailCampaign;
  const letter={...raw,name,printBody:string(raw.printBody),printSubject:string(raw.printSubject),printLayoutJson:raw.printLayoutJson||{},documentSchemaVersion:raw.documentJson?2:1} as unknown as LetterTemplate;
  const converted=convertLegacy(channel==="LETTER"?letter:email,channel);assertStudioAssetOwnership(org,converted.design);
  if(!converted.design.body.content.length)throw new CreateError(422,"No supported content was found in this browser item. Its local original remains available.");
  const brand=sanitizeBrandHtml(await readLegacyBrand(org,channel==="LETTER"?{headerId:string(raw.headerPresetId),footerId:string(raw.footerPresetId),signerId:string(raw.signatureBlockId)}:{}));
  const result=await prisma.$transaction(async tx=>{
    const source=await tx.createImportSource.create({data:{organizationId:org,sourceType,sourceId,name,ownerId:actor,shared:false,status:"NEEDS_REVIEW",fingerprint:hash,acceptedFingerprint:hash,diagnostics:json(converted.diagnostics)}});
    const revision=await tx.createImportSourceRevision.create({data:{sourceId:source.id,fingerprint:hash,snapshotJson:json({record:raw,originalHtml:converted.originalHtml,brand})}});
    converted.design.presentation={...converted.design.presentation,sourceRevisionId:revision.id};
    for(const node of walkNodes(converted.design.body))if(node.type==="studioHtml"&&node.attrs?.sourceRevisionId!==undefined)node.attrs.sourceRevisionId=revision.id;
    if(kind==="SECTION"){
      await tx.createStudioSection.create({data:{organizationId:org,ownerId:actor,name,shared:false,documentJson:json(converted.design.body)}});
      return {sourceId:source.id,campaignId:null};
    }
    const campaign=await tx.createCampaign.create({data:{organizationId:org,ownerId:actor,name,objective:"GENERAL",audienceListIds:json([]),channelsJson:json([channel])}});
    const content=await tx.createContent.create({data:{organizationId:org,campaignId:campaign.id,name,documentJson:json({version:1,blocks:[]}),designJson:json(converted.design)}});
    const backing=channel==="LETTER"?await tx.letterTemplate.create({data:{organizationId:org,name,printBody:letter.printBody,printSubject:letter.printSubject,createdByUserId:actor,crmScope:"DONOR"}}):null;
    const native=backing?await nativeRecord(org,{channel,legacyId:backing.id},tx):null;
    await tx.createVariant.create({data:{organizationId:org,contentId:content.id,channel,legacyId:backing?.id||null,legacyFingerprint:native?.fingerprint||null,documentJson:json({subject:email.subject})}});
    await tx.createDocumentRevision.create({data:{organizationId:org,contentId:content.id,revision:1,documentJson:json({shared:content.documentJson,studio:converted.design}),createdBy:actor}});
    await tx.createImportSource.update({where:{id:source.id},data:{campaignId:campaign.id,contentId:content.id}});
    return {sourceId:source.id,campaignId:campaign.id};
  });res.status(201).json({recovered:true,...result});
}));
export default router;
