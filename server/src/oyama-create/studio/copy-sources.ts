import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { json } from "../../services/letter-production.js";
import { fingerprint } from "../legacy.js";
import { sourceRevisionFor } from "./source-html.js";
import { walkNodes } from "./design.js";
import type { StudioDesign } from "./types.js";

/** A deliberate new draft owns its snapshots; later changes to the original's ACL cannot break it. */
export async function copyStudioSources(req:Request,tx:Prisma.TransactionClient,org:string,actor:string,campaignId:string,contentId:string,design:StudioDesign){
  const ids=new Set<string>();
  if(design.presentation?.sourceRevisionId)ids.add(design.presentation.sourceRevisionId);
  for(const channel of Object.values(design.channels||{})){if(channel.sourceRevisionId)ids.add(channel.sourceRevisionId);if(channel.presentation?.sourceRevisionId)ids.add(channel.presentation.sourceRevisionId);}
  const nodes=[design.body,design.pack.replySlip.content,...Object.values(design.regions).map(item=>item.content),...Object.values(design.channels||{}).map(item=>item.document),...Object.values(design.email.overrides)].flatMap(walkNodes);
  for(const node of nodes)if(node.attrs?.sourceRevisionId)ids.add(String(node.attrs.sourceRevisionId));
  const mapped=new Map<string,string>();
  for(const id of ids){
    const original=await sourceRevisionFor(req,org,id),sourceType=original.source.sourceType.includes("GENERATED_LETTER")?"COPY_GENERATED_LETTER":original.source.sourceType.endsWith("LETTER")?"COPY_LETTER":"COPY_EMAIL";
    const source=await tx.createImportSource.upsert({where:{organizationId_sourceType_sourceId:{organizationId:org,sourceType,sourceId:contentId}},update:{},create:{organizationId:org,sourceType,sourceId:contentId,name:original.source.name,ownerId:actor,shared:false,campaignId,contentId,status:"CONVERTED",diagnostics:json([])}});
    const revision=await tx.createImportSourceRevision.create({data:{sourceId:source.id,fingerprint:fingerprint([id,original.fingerprint]),snapshotJson:json({...original.snapshotJson as Prisma.JsonObject,kind:"DRAFT_COPY",copiedFromRevisionId:id})}});
    mapped.set(id,revision.id);
  }
  const remap=(id:string|undefined)=>id?mapped.get(id)||id:id;
  if(design.presentation)design.presentation.sourceRevisionId=remap(design.presentation.sourceRevisionId);
  for(const channel of Object.values(design.channels||{})){channel.sourceRevisionId=remap(channel.sourceRevisionId);if(channel.presentation)channel.presentation.sourceRevisionId=remap(channel.presentation.sourceRevisionId);}
  for(const node of nodes)if(node.attrs?.sourceRevisionId){const old=String(node.attrs.sourceRevisionId);node.attrs.sourceRevisionId=remap(old);if(node.attrs.reviewedHtml===old)node.attrs.reviewedHtml=remap(old);}
  return design;
}
