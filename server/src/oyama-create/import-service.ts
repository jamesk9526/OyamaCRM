import { unregisteredUploads, registerUpload } from "./import-assets.js";
import { randomUUID } from "node:crypto";
import { Prisma, type CreateImportSource, type EmailCampaign, type LetterTemplate } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { assertCampaign, can, demand, demandChannels, touchCampaign } from "./access.js";
import { CreateError, object, string, variantFrom } from "./domain.js";
import { nativeRecord, fingerprint, parseStored, reusableEmailRecord, emailRecordSharing, emailRecordAccessible } from "./legacy.js";
import { isTrashed } from "./trash-state.js";
import { normalizeDesign } from "./studio/design.js";
import { convertLegacy } from "./studio/conversion.js";
import { readLegacyBrand, sanitizeBrandHtml } from "./studio/brand-service.js";
import { assertStudioAssetOwnership } from "./studio/asset-ownership.js";
import { managedAssetIssues } from "./studio/asset-files.js";

export const SOURCE_TYPES = ["EMAIL", "LETTER", "GENERATED_LETTER", "HEADER", "FOOTER", "SIGNATURE", "ASSET", "UPLOADS"] as const;
export type SourceType = typeof SOURCE_TYPES[number];
type SourceRecord = Record<string, unknown> & { id: string; name?: string; updatedAt?: Date; createdAt?: Date };
export function sourceFingerprint(record:Record<string,unknown>){
  const stable={...record};for(const key of ["updatedAt","delivered","opened","clicked","bounced","unsubscribed"])delete stable[key];return fingerprint(stable);
}
const sourceKey = (org: string, type: string, id: string) => ({ organizationId_sourceType_sourceId: { organizationId: org, sourceType: type, sourceId: id } });
export function isExecution(email: Pick<EmailCampaign,"audienceFilter">) { return !!object(parseStored(email.audienceFilter))._create; }
export function isHistorical(email: EmailCampaign) { return email.status !== "DRAFT" || !!email.sentAt || !!email.scheduledAt || email.totalRecipients > 0; }
export function sourceAccess(req: Request, source: Pick<CreateImportSource,"ownerId"|"shared">, manage = false) {
  return req.user?.role === "admin" || !source.ownerId || source.ownerId === req.user?.sub || !manage && source.shared;
}
export async function demandImportAdmin(req: Request) {
  if (req.user?.role !== "admin") throw new CreateError(403,"An organization administrator manages automatic imports.");
  await demandChannels(req,["EMAIL","LETTER"],true); await demand(req,"letters.create");
}
export async function sourcePage(org: string, type: SourceType, after = "", take = 50): Promise<SourceRecord[]> {
  const args = { where: { organizationId: org, ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: "asc" as const }, take };
  switch (type) {
    case "UPLOADS": return (await unregisteredUploads(org)).filter(item=>item.id>after).slice(0,take);
    case "EMAIL": return prisma.emailCampaign.findMany(args) as unknown as Promise<SourceRecord[]>;
    case "LETTER": return prisma.letterTemplate.findMany({...args,where:{...args.where,crmScope:"DONOR"}}) as unknown as Promise<SourceRecord[]>;
    case "GENERATED_LETTER": return prisma.generatedLetter.findMany({...args,where:{...args.where,template:{crmScope:"DONOR"}}}) as unknown as Promise<SourceRecord[]>;
    case "HEADER": return prisma.letterHeaderPreset.findMany(args) as unknown as Promise<SourceRecord[]>;
    case "FOOTER": return prisma.letterFooterPreset.findMany(args) as unknown as Promise<SourceRecord[]>;
    case "SIGNATURE": return prisma.letterSignatureBlock.findMany(args) as unknown as Promise<SourceRecord[]>;
    case "ASSET": return prisma.createStudioAsset.findMany(args) as unknown as Promise<SourceRecord[]>;
  }
}
export async function inventory(org: string) {
  const counts = await Promise.all([
    prisma.emailCampaign.count({where:{organizationId:org}}), prisma.letterTemplate.count({where:{organizationId:org,crmScope:"DONOR"}}),
    prisma.generatedLetter.count({where:{organizationId:org,template:{crmScope:"DONOR"}}}),prisma.letterHeaderPreset.count({where:{organizationId:org}}),
    prisma.letterFooterPreset.count({where:{organizationId:org}}),prisma.letterSignatureBlock.count({where:{organizationId:org}}),prisma.createStudioAsset.count({where:{organizationId:org}}), unregisteredUploads(org).then(items=>items.length),
  ]);
  const statuses = ["CONVERTED","NEEDS_REVIEW","SOURCE_CHANGED","HISTORICAL","CATALOGED","FAILED"];
  const accounted = await Promise.all(statuses.map(status=>prisma.createImportSource.count({where:{organizationId:org,status}})));
  return { totals:Object.fromEntries(SOURCE_TYPES.map((type,index)=>[type,counts[index]])), total:counts.reduce((a,b)=>a+b,0), statuses:Object.fromEntries(statuses.map((status,index)=>[status,accounted[index]])), existingBindings:await prisma.createVariant.count({where:{organizationId:org,legacyId:{not:null}}}) };
}
async function snapshotSource(org: string, type: string, record: SourceRecord, ownerId: string|null, shared: boolean, extra: Record<string,unknown> = {}) {
  const hash = sourceFingerprint(record), source = await uniqueUpsert(
    ()=>prisma.createImportSource.upsert({where:sourceKey(org,type,record.id),update:{},create:{organizationId:org,sourceType:type,sourceId:record.id,name:String(record.name||`${type} ${record.id}`).slice(0,191),ownerId,shared,diagnostics:json([])}}),
    ()=>prisma.createImportSource.findUnique({where:sourceKey(org,type,record.id)}));
  const revisionKey={sourceId_fingerprint:{sourceId:source.id,fingerprint:hash}};
  const revision = await uniqueUpsert(
    ()=>prisma.createImportSourceRevision.upsert({where:revisionKey,update:{},create:{sourceId:source.id,fingerprint:hash,snapshotJson:json({record,...extra})}}),
    ()=>prisma.createImportSourceRevision.findUnique({where:revisionKey}));
  return { source, revision, hash };
}
async function uniqueUpsert<T>(write:()=>Promise<T>,read:()=>Promise<T|null>):Promise<T>{
  try{return await write();}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){const existing=await read();if(existing)return existing;}throw error;}
}
export async function importCommunication(req: Request, org: string, actor: string, channel: "EMAIL"|"LETTER", legacyId: string) {
  await demandChannels(req,[channel],true); if(channel==="LETTER")await demand(req,"letters.create");
  const native = await nativeRecord(org,{channel,legacyId});
  if(!native)throw new CreateError(404,"Legacy content not found.");
  if(native.kind==="EMAIL"&&!emailRecordAccessible(native.record,actor,req.user!.role,true))throw new CreateError(403,"Only the owner or an administrator may import this email.");
  const sharing = native.kind==="EMAIL"?emailRecordSharing(native.record):{ownerId:native.record.createdByUserId,sharedWithOrganization:true};
  const brand = sanitizeBrandHtml(await readLegacyBrand(org,native.kind==="LETTER"?{headerId:native.record.headerPresetId,footerId:native.record.footerPresetId,signerId:native.record.signatureBlockId}:{}));
  const converted = convertLegacy(native.record,channel);
  converted.diagnostics.push(...(await managedAssetIssues(org,converted.originalHtml)).map(issue=>issue.message));
  if(channel==="LETTER"&&!/data-letter-signature|data-keep-together=["']signature/i.test(converted.originalHtml)){
    const signerId=(native.kind==="LETTER"&&native.record.signatureBlockId)||brand.defaultSignerId;
    if(signerId)converted.design.body.content.push({type:"studioSignature",attrs:{studioId:"import-signature",signerId}});
  }
  const {source,revision,hash}=await snapshotSource(org,channel,native.record as unknown as SourceRecord,sharing.ownerId,sharing.sharedWithOrganization,{originalHtml:converted.originalHtml,brand});
  converted.design.presentation={...converted.design.presentation,sourceRevisionId:revision.id};
  for(const node of converted.design.body.content)if(node.type==="studioHtml"&&node.attrs?.sourceRevisionId!==undefined)node.attrs.sourceRevisionId=revision.id;
  assertStudioAssetOwnership(org,converted.design); assertStudioAssetOwnership(org,brand);
  const existing=await prisma.createVariant.findFirst({where:{organizationId:org,channel,legacyId},include:{content:true}});
  if(native.kind==="EMAIL"&&isHistorical(native.record)&&existing?.content.designJson){
    await prisma.createImportSource.update({where:{id:source.id},data:{fingerprint:hash,acceptedFingerprint:hash,campaignId:existing.content.campaignId,contentId:existing.contentId,status:"HISTORICAL",ownerId:sharing.ownerId,shared:sharing.sharedWithOrganization,missing:false,lastSeenAt:new Date(),diagnostics:json(["The legacy email is now a delivery execution. Its original and Create work are retained; use a separate new draft to send again."])}});
    return {campaignId:existing.content.campaignId,contentId:existing.contentId,historical:true,groupedCompanion:false};
  }
  if(source.acceptedFingerprint && source.acceptedFingerprint!==hash && existing && source.status!=="HISTORICAL") {
    await prisma.createImportSource.update({where:{id:source.id},data:{fingerprint:hash,status:"SOURCE_CHANGED",ownerId:sharing.ownerId,shared:sharing.sharedWithOrganization,missing:false,lastSeenAt:new Date()}});
    return {campaignId:existing.content.campaignId,contentId:existing.contentId,historical:false,groupedCompanion:false,sourceChanged:true};
  }
  if(existing?.content.designJson || existing && await isTrashed(org,"CAMPAIGN",existing.content.campaignId)) {
    if(existing?.content.designJson&&!source.acceptedFingerprint&&!await isTrashed(org,"CAMPAIGN",existing.content.campaignId)){
      const old=normalizeDesign(existing.content.designJson),base=old.presentation?.sourceRevisionId?await prisma.createImportSourceRevision.findFirst({where:{id:old.presentation.sourceRevisionId},include:{source:true}}):null;
      if(base&&["EMAIL","LETTER"].includes(base.source.sourceType)&&base.source.sourceType!==channel&&!old.channels?.[channel]&&!(channel==="EMAIL"&&Object.keys(old.email.overrides).length)){
        await prisma.$transaction(async tx=>{
          const content=await tx.createContent.findUniqueOrThrow({where:{id:existing.contentId}}),design=normalizeDesign(content.designJson);
          if(design.channels?.[channel])return;
          design.channels={...design.channels,[channel]:{document:converted.design.body,reviewedSource:null,sourceRevisionId:revision.id,presentation:converted.design.presentation}};
          if(channel==="EMAIL"){design.email.subject=converted.design.email.subject;design.email.previewText=converted.design.email.previewText;}
          else{design.page=converted.design.page;design.regions=converted.design.regions;}
          const updated=await tx.createContent.updateMany({where:{id:content.id,revision:content.revision},data:{designJson:json(design),revision:{increment:1}}});if(!updated.count)throw new CreateError(409,"The Studio draft changed during companion import. Retry this source.");
          await tx.createDocumentRevision.create({data:{organizationId:org,contentId:content.id,revision:content.revision+1,documentJson:json({shared:content.documentJson,studio:design}),createdBy:actor}});
          await tx.createImportSource.update({where:{id:source.id},data:{status:"NEEDS_REVIEW",diagnostics:json([...converted.diagnostics,"Existing companion binding retained as a protected channel adaptation."])}});
        });
      }
    }
    const current=await prisma.createImportSource.findUniqueOrThrow({where:{id:source.id}});
    await prisma.createImportSource.update({where:{id:source.id},data:{fingerprint:hash,acceptedFingerprint:source.acceptedFingerprint||hash,campaignId:existing.content.campaignId,contentId:existing.contentId,status:current.status==="PENDING"?"CONVERTED":current.status,missing:false,lastSeenAt:new Date()}});
    return {campaignId:existing.content.campaignId,contentId:existing.contentId,historical:false,groupedCompanion:false};
  }
  if(native.kind==="EMAIL"&&isExecution(native.record)) {
    const execution=object(parseStored(native.record.audienceFilter))._create;
    const deliveryId=string(object(execution).deliveryId),delivery=deliveryId?await prisma.createDelivery.findFirst({where:{id:deliveryId,organizationId:org},include:{release:true}}):null;
    await prisma.createImportSource.update({where:{id:source.id},data:{campaignId:delivery?.release.campaignId||null,contentId:delivery?.contentId||null,fingerprint:hash,acceptedFingerprint:hash,status:"HISTORICAL",diagnostics:json(["Create delivery execution retained in history; not imported as a new campaign."]),lastSeenAt:new Date()}});
    return {campaignId:delivery?.release.campaignId||null,contentId:delivery?.contentId||null,historical:true,groupedCompanion:false};
  }
  const historical=native.kind==="EMAIL"&&isHistorical(native.record), reusable=native.kind==="LETTER"||reusableEmailRecord(native.record);
  const audience=native.kind==="EMAIL"?parseStored(native.record.audienceFilter):{};
  const listIds=[...new Set([string(audience.recipientListId),...(Array.isArray(audience.recipientListIds)?audience.recipientListIds.filter((id):id is string=>typeof id==="string"):[])].filter(Boolean))];
  const lists=await prisma.emailRecipientList.findMany({where:{organizationId:org,id:{in:listIds}},select:{id:true}});
  const envelope=native.kind==="LETTER"?object(native.record.printLayoutJson):{};
  const emailWorkflow=native.kind==="EMAIL"?object(parseStored(native.record.templateJson)._workflow):{};
  const companionId=envelope.schema==="oyama-communication-roundtrip-v1"?string(envelope.sourceTemplateId):"";
  const emailSourceLetter=string(emailWorkflow.source)==="letters_template"?string(emailWorkflow.sourceTemplateId):"";
  const companionChannel=companionId?"EMAIL":"LETTER",verifiedCompanionId=companionId||emailSourceLetter;
  const companion=verifiedCompanionId&&await can(req,companionChannel==="EMAIL"?"edit:communications":"letters.edit")?await prisma.createVariant.findFirst({where:{organizationId:org,channel:companionChannel,legacyId:verifiedCompanionId},include:{content:{include:{campaign:true}}}}):null;
  if(companion)await assertCampaign(req,companion.content.campaignId,true);
  try {
    return await prisma.$transaction(async tx=>{
      // Lock the source row before binding/conversion. The unique source key survives retries.
      await tx.createImportSource.update({where:{id:source.id},data:{lastSeenAt:new Date()}});
      const bound=await tx.createVariant.findFirst({where:{organizationId:org,channel,legacyId},include:{content:true}});
      const campaign=bound?await tx.createCampaign.findUniqueOrThrow({where:{id:bound.content.campaignId}}):companion?.content.campaign||await tx.createCampaign.create({data:{organizationId:org,ownerId:sharing.ownerId||actor,name:native.record.name,objective:"GENERAL",status:historical?"HISTORICAL":"DRAFT",isTemplate:reusable,audienceListIds:json(lists.map(item=>item.id)),channelsJson:json([channel])}});
      const content=bound?.content||companion?.content||await tx.createContent.create({data:{organizationId:org,campaignId:campaign.id,name:native.record.name,documentJson:json({version:1,blocks:[]})}});
      if(!bound)await tx.createVariant.create({data:{organizationId:org,contentId:content.id,channel,legacyId,legacyFingerprint:native.fingerprint,nativeApproved:true,documentJson:json(variantFrom({subject:native.kind==="EMAIL"?native.record.subject:native.record.printSubject||native.record.name}))}});
      if(companion&&!bound)await tx.createCampaign.update({where:{id:campaign.id},data:{channelsJson:json([...new Set([...(campaign.channelsJson as string[]),channel])]),revision:{increment:1}}});
      if(companion&&!bound&&content.designJson&&!historical){
        const design=normalizeDesign(content.designJson);design.version=3;design.channels={...design.channels,[channel]:{document:converted.design.body,reviewedSource:null,sourceRevisionId:revision.id,presentation:converted.design.presentation}};
        if(channel==="LETTER"){design.page=converted.design.page;design.regions=converted.design.regions;}else{design.email.subject=converted.design.email.subject;design.email.previewText=converted.design.email.previewText;}
        await tx.createContent.update({where:{id:content.id},data:{designJson:json(design),revision:{increment:1}}});
        await tx.createDocumentRevision.create({data:{organizationId:org,contentId:content.id,revision:content.revision+1,documentJson:json({shared:content.documentJson,studio:design}),createdBy:actor}});
        converted.diagnostics.push("Verified companion retained as a protected channel adaptation; compare both originals.");
      }
      // Never replace an already managed design when a second companion arrives.
      if(!historical&&!content.designJson){
        await tx.createDocumentRevision.upsert({where:{contentId_revision:{contentId:content.id,revision:content.revision}},update:{},create:{organizationId:org,contentId:content.id,revision:content.revision,documentJson:json({shared:content.documentJson,originalSourceRevisionId:revision.id}),createdBy:actor}});
        await tx.createContent.update({where:{id:content.id},data:{designJson:json(converted.design),revision:{increment:1}}});
        await tx.createDocumentRevision.create({data:{organizationId:org,contentId:content.id,revision:content.revision+1,documentJson:json({shared:content.documentJson,studio:converted.design}),createdBy:actor}});
      }
      await tx.createImportSource.update({where:{id:source.id},data:{name:native.record.name,ownerId:sharing.ownerId,shared:sharing.sharedWithOrganization,fingerprint:hash,acceptedFingerprint:hash,campaignId:campaign.id,contentId:content.id,status:historical?"HISTORICAL":converted.diagnostics.length?"NEEDS_REVIEW":"CONVERTED",diagnostics:json(converted.diagnostics),error:null,missing:false,sourceUpdatedAt:native.record.updatedAt,lastSeenAt:new Date()}});
      return {campaignId:campaign.id,contentId:content.id,historical,groupedCompanion:!!companion};
    });
  } catch(error) {
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002") {
      const bound=await prisma.createVariant.findFirst({where:{organizationId:org,channel,legacyId}});
      if(bound)return {campaignId:(await prisma.createContent.findUniqueOrThrow({where:{id:bound.contentId}})).campaignId,contentId:bound.contentId,historical,groupedCompanion:false};
    }
    throw error;
  }
}

export async function ensureImport(req: Request) {
  await demandImportAdmin(req); const org=req.user!.orgId,actor=req.user!.sub;
  const existing=await prisma.createImportRun.findUnique({where:{organizationId:org}});if(existing)return existing;
  const initial=await inventory(org);
  return uniqueUpsert(()=>prisma.createImportRun.upsert({where:{organizationId:org},update:{},create:{organizationId:org,actorId:actor,cursorJson:json({phase:0,after:""}),inventoryJson:json({capturedAt:new Date().toISOString(),...initial})}}),()=>prisma.createImportRun.findUnique({where:{organizationId:org}}));
}
export async function catalogSource(req:Request,org:string,actor:string,type:SourceType,record:SourceRecord) {
  if(type==="EMAIL"||type==="LETTER")return importCommunication(req,org,actor,type,record.id);
  if(type==="UPLOADS"){const asset=await registerUpload(org,actor,string(record.storagePath));return catalogSource(req,org,actor,"ASSET",asset as unknown as SourceRecord);}
  const {source,hash}=await snapshotSource(org,type,record,null,true);
  await prisma.createImportSource.update({where:{id:source.id},data:{fingerprint:hash,acceptedFingerprint:hash,status:type==="GENERATED_LETTER"?"HISTORICAL":"CATALOGED",missing:false,lastSeenAt:new Date(),sourceUpdatedAt:record.updatedAt}});
}
let timer:ReturnType<typeof setInterval>|null=null,processing=false,unavailableUntil=0;
export async function processImports(batchSize=25,scopeOrg?:string) {
  const now=new Date(),runs=await prisma.createImportRun.findMany({where:{...(scopeOrg?{organizationId:scopeOrg}:{}),status:{in:["RUNNING","IDLE"]},nextScanAt:{lte:now},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},orderBy:{nextScanAt:"asc"},take:3});
  for(const run of runs){
    const token=randomUUID();const claimed=await prisma.createImportRun.updateMany({where:{id:run.id,status:{in:["RUNNING","IDLE"]},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{leaseToken:token,leaseUntil:new Date(Date.now()+120000)}});if(!claimed.count)continue;
    try {
      const user=await prisma.user.findFirst({where:{id:run.actorId,organizationId:run.organizationId,role:"admin",active:true}});
      if(!user)throw new CreateError(403,"An active administrator must resume automatic imports.");
      const req={user:{sub:user.id,orgId:run.organizationId,role:user.role,email:user.email}} as Request;await demandImportAdmin(req);
      const cursor=object(run.cursorJson),startedAt=string(cursor.startedAt)||new Date().toISOString(),phase=Number(cursor.phase)||0,type=SOURCE_TYPES[phase];
      const records=await sourcePage(run.organizationId,type,string(cursor.after),batchSize);
      let interrupted=false;
      for(const record of records){
        const current=await prisma.createImportRun.findUnique({where:{id:run.id}});if(current?.status==="PAUSED"||current?.leaseToken!==token){interrupted=true;break;}
        await prisma.createImportRun.updateMany({where:{id:run.id,leaseToken:token},data:{leaseUntil:new Date(Date.now()+120000)}});
        try{await catalogSource(req,run.organizationId,user.id,type,record);}catch(error){
          const reason=error instanceof Error?error.message:"Import failed.";
          const {source}=await snapshotSource(run.organizationId,type,record,user.id,false);
          await prisma.createImportSource.update({where:{id:source.id},data:{status:"FAILED",error:reason,lastSeenAt:new Date()}});
        }
        await prisma.createImportRun.updateMany({where:{id:run.id,leaseToken:token},data:{cursorJson:json({phase,after:record.id,startedAt}),scanned:{increment:1}}});
      }
      if(!interrupted&&records.length<batchSize){
        const current=await prisma.createImportRun.findUnique({where:{id:run.id}});if(current?.leaseToken!==token||current.status==="PAUSED")continue;
        const finished=phase+1>=SOURCE_TYPES.length;
        if(finished)await prisma.createImportSource.updateMany({where:{organizationId:run.organizationId,sourceType:{in:[...SOURCE_TYPES]},lastSeenAt:{lt:new Date(startedAt)}},data:{missing:true}});
        await prisma.createImportRun.updateMany({where:{id:run.id,leaseToken:token,status:{not:"PAUSED"}},data:{cursorJson:json({phase:finished?0:phase+1,after:"",...(finished?{}:{startedAt})}),status:finished?"IDLE":"RUNNING",nextScanAt:finished?new Date(Date.now()+300000):new Date(),lastError:null}});
      }
    }catch(error){await prisma.createImportRun.updateMany({where:{id:run.id,leaseToken:token},data:{status:"PAUSED",lastError:error instanceof Error?error.message:"Import worker failed."}});}
    finally{await prisma.createImportRun.updateMany({where:{id:run.id,leaseToken:token},data:{leaseToken:null,leaseUntil:null}});}
  }
  return runs.length;
}
export function startImportWorker(){if(timer)return;timer=setInterval(()=>{if(processing||Date.now()<unavailableUntil)return;processing=true;void processImports().catch(error=>{if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2021"){unavailableUntil=Date.now()+300000;console.warn("[Create import] Awaiting automatic-import migration.");}else console.error("[Create import]",error instanceof Error?error.message:"failed");}).finally(()=>{processing=false;});},3000);timer.unref();}
export function stopImportWorker(){if(timer)clearInterval(timer);timer=null;}

export async function reconcileSource(req:Request,source:CreateImportSource,choice:"KEEP_CREATE"|"USE_SOURCE",campaignRevision:number){
  if(!sourceAccess(req,source,true)||!source.contentId||!source.campaignId)throw new CreateError(403,"Only the owner or administrator can reconcile this source.");
  const campaign=await assertCampaign(req,source.campaignId,true);await demandChannels(req,campaign.channelsJson as ("EMAIL"|"LETTER")[],true);
  const revision=await prisma.createImportSourceRevision.findUnique({where:{sourceId_fingerprint:{sourceId:source.id,fingerprint:source.fingerprint!}}});
  if(!revision)throw new CreateError(409,"Refresh the source comparison.");
  const snapshot=object(revision.snapshotJson),record=object(snapshot.record),channel=source.sourceType as "EMAIL"|"LETTER";
  const native=await nativeRecord(source.organizationId,{channel,legacyId:source.sourceId});
  if(!native||sourceFingerprint(native.record)!==source.fingerprint)throw new CreateError(409,"The source changed again. Refresh the comparison.");
  const converted=convertLegacy(record as unknown as EmailCampaign|LetterTemplate,channel,revision.id);converted.design.presentation={...converted.design.presentation,sourceRevisionId:revision.id};
  await prisma.$transaction(async tx=>{
    await touchCampaign(tx,source.organizationId,campaign.id,campaignRevision);
    if(choice==="USE_SOURCE"){
      const current=await tx.createContent.findUniqueOrThrow({where:{id:source.contentId!}}),old=current.designJson?normalizeDesign(current.designJson):null;
      let next=converted.design;
      if(old?.channels?.[channel]?.sourceRevisionId){next=old;next.channels![channel]={document:converted.design.body,reviewedSource:null,sourceRevisionId:revision.id,presentation:converted.design.presentation};if(channel==="EMAIL"){next.email.subject=converted.design.email.subject;next.email.previewText=converted.design.email.previewText;}}
      else if(old?.channels)next.channels={...converted.design.channels,...old.channels};
      const content=await tx.createContent.update({where:{id:source.contentId!},data:{designJson:json(next),revision:{increment:1}}});
      await tx.createDocumentRevision.create({data:{organizationId:source.organizationId,contentId:content.id,revision:content.revision,documentJson:json({shared:content.documentJson,studio:next}),createdBy:req.user!.sub}});
    }
    await tx.createVariant.updateMany({where:{organizationId:source.organizationId,contentId:source.contentId!,channel},data:{legacyFingerprint:native.fingerprint,needsReview:false,revision:{increment:1}}});
    await tx.createImportSource.update({where:{id:source.id},data:{acceptedFingerprint:source.fingerprint,status:choice==="USE_SOURCE"?"NEEDS_REVIEW":"CONVERTED"}});
    await tx.auditLog.create({data:{organizationId:source.organizationId,userId:req.user!.sub,action:"CREATE_SOURCE_RECONCILED",entity:"CreateImportSource",entityId:source.id,metadata:{choice,fingerprint:source.fingerprint}}});
  });
}
