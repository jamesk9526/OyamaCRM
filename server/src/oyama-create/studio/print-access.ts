import type {Request,Response,NextFunction} from "express";
import {prisma} from "../../lib/prisma.js";
import {ProductionError} from "../../services/letter-production.js";
import {can} from "../access.js";
import {object} from "../domain.js";

export async function assertStudioPrintAccess(req:Request,snapshot:unknown){
  if([object(object(snapshot).studio),object(object(snapshot).classic)].some(profile=>profile.sensitive===true)&&!await can(req,"letters.view_sensitive_merge_data"))throw new ProductionError(403,"Sensitive donor output requires letters.view_sensitive_merge_data permission.");
}
export async function assertStudioArtifactAccess(req:Request,org:string,id:string){
  const job=await prisma.letterRenderJob.findFirst({where:{id,organizationId:org},select:{snapshotJson:true}});
  if(job)await assertStudioPrintAccess(req,job.snapshotJson);
}
export function maskStudioGenerated<T extends {metadataJson?:unknown}>(rows:T[],allowed:boolean):T[]{
  if(allowed)return rows;
  return rows.map(row=>object(row.metadataJson).studioSensitive===true?{...row,mergedPrintBody:"<p>Sensitive donor output requires permission.</p>",mergedEmailBody:null,mergedPrintSubject:"Restricted donor letter",emailSubject:null,donation:null,pdfUrl:null}:row);
}
/** Stops a generated Studio letter from being reconstructed through legacy write/export actions. */
export async function studioGeneratedGuard(req:Request,res:Response,next:NextFunction){
  try{
    const org=req.user?.orgId;if(!org||["GET","HEAD","OPTIONS"].includes(req.method)||await can(req,"letters.view_sensitive_merge_data")){next();return;}
    const candidate=req.path.split("/").filter(Boolean)[0];const supplied=[req.body?.letterIds,req.body?.generatedLetterIds,req.body?.ids].flatMap(value=>Array.isArray(value)?value:[]).filter((value):value is string=>typeof value==="string");
    if(supplied.length>500){res.status(400).json({error:{code:"BATCH_LIMIT",message:"Review at most 500 generated letters per action."}});return;}
    const ids=[...new Set([...supplied,...(candidate?[candidate]:[])])];
    const rows=await prisma.generatedLetter.findMany({where:{organizationId:org,id:{in:ids}},select:{metadataJson:true}});
    if(rows.some(row=>object(row.metadataJson).studioSensitive===true)){res.status(403).json({error:{code:"SENSITIVE_MERGE_PERMISSION",message:"Sensitive donor output requires letters.view_sensitive_merge_data permission."}});return;}
    next();
  }catch(error){next(error);}
}
