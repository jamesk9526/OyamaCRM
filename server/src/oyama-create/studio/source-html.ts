import type { Request } from "express";
import { prisma } from "../../lib/prisma.js";
import { CreateError, object, string } from "../domain.js";
import { sourceAccess } from "../import-service.js";
import { emailRecordAccessible } from "../legacy.js";
import { can, demand } from "../access.js";
import { walkNodes } from "./design.js";
import { sanitizeStudioHtml } from "./html.js";
import { assertStudioAssetOwnership } from "./asset-ownership.js";
import type { StudioDesign } from "./types.js";

export async function sourceRevisionFor(req:Request,org:string,id:string){
  const revision=await prisma.createImportSourceRevision.findFirst({where:{id},include:{source:true}});
  if(!revision||revision.source.organizationId!==org||!sourceAccess(req,revision.source))throw new CreateError(404,"The preserved source is unavailable in this organization.");
  const type=revision.source.sourceType;
  if(type.includes("GENERATED_LETTER")){await demand(req,"letters.view");await demand(req,"letters.view_sensitive_merge_data");}
  else if(type.endsWith("LETTER")||type==="BROWSER_DRAFT"&&typeof object(object(revision.snapshotJson).record).printBody==="string")await demand(req,"letters.view");
  else if(["HEADER","FOOTER","SIGNATURE","ASSET"].includes(type)){if(!await can(req,"letters.view")&&!await can(req,"view:communications"))throw new CreateError(403,"Library access is required.");}
  else await demand(req,"view:communications");
  if(revision.source.sourceType === "EMAIL") {
    const email=await prisma.emailCampaign.findFirst({where:{id:revision.source.sourceId,organizationId:org}});
    if(email&&!emailRecordAccessible(email,req.user!.sub,req.user!.role))throw new CreateError(404,"The source email's sharing permissions changed.");
  }
  return revision;
}
export async function hydrateSourceHtml(req:Request,org:string,design:StudioDesign):Promise<StudioDesign>{
  if(design.presentation?.sourceRevisionId)await sourceRevisionFor(req,org,design.presentation.sourceRevisionId);
  for(const channel of Object.values(design.channels||{}))if(channel.sourceRevisionId)await sourceRevisionFor(req,org,channel.sourceRevisionId);
  const result=structuredClone(design),documents=[result.body,result.pack.replySlip.content,...Object.values(result.regions).map(region=>region.content),...Object.values(result.email.overrides),...Object.values(result.channels||{}).map(channel=>channel.document)];
  for(const node of documents.flatMap(walkNodes))if(node.type==="studioHtml"&&node.attrs?.sourceRevisionId){
    const revision=await sourceRevisionFor(req,org,String(node.attrs.sourceRevisionId));
    node.attrs.html=sanitizeStudioHtml(string(object(revision.snapshotJson).originalHtml));
  }
  assertStudioAssetOwnership(org,result);return result;
}
