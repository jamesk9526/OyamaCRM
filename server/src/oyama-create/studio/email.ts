import { Router } from "express";
import { absolutizeEmailAssetUrls } from "../../services/oyama-email/email-render-service.js";
import { EmailPurpose } from "@prisma/client";
import { json } from "../../services/letter-production.js";
import { prisma } from "../../lib/prisma.js";
import { createOrganizationEmailSender, resolveOrganizationSmtpSettings } from "../../services/smtp-service.js";
import { contentFor } from "../content.js";
import { demand, touchCampaign } from "../access.js";
import { nativeRecord } from "../legacy.js";
import { route, param } from "../http.js";
import { CreateError, string, variantFrom } from "../domain.js";
import { normalizeDesign } from "./design.js";
import { hydrateSourceHtml } from "./source-html.js";
import { brandForStudio } from "./brand-service.js";
import { renderEmailDocument } from "./render.js";
import { resolveStudioDonor } from "./donor.js";
const router = Router();
const emailAddress=(value:unknown)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string(value));
router.get("/contents/:id/studio/email-settings",route(async(req,res,org)=>{
 await demand(req,"view:communications");const {content}=await contentFor(req,param(req));const variant=content.variants.find(item=>item.channel==="EMAIL");if(!variant)throw new CreateError(404,"Email version not found.");
 const native=await nativeRecord(org,variant,prisma,true),settings=await resolveOrganizationSmtpSettings(org);
 const sender=variantFrom(variant.documentJson).sender;
 res.json({fromName:sender?.fromName||(native?.kind==="EMAIL"?native.record.fromName:settings.smtpFromName||""),fromEmail:settings.smtpFromEmail||"",replyToEmail:sender?.replyToEmail||(native?.kind==="EMAIL"?native.record.replyToEmail||"":""),purpose:sender?.purpose||(native?.kind==="EMAIL"?native.record.purpose:"MARKETING"),contentRevision:content.revision,externalChanges:!!native&&native.fingerprint!==variant.legacyFingerprint});
}));
router.put("/contents/:id/studio/email-settings",route(async(req,res,org)=>{
 await demand(req,"edit:communications");const {content,campaign}=await contentFor(req,param(req),true);const variant=content.variants.find(item=>item.channel==="EMAIL");if(!content.designJson||!variant)throw new CreateError(404,"Studio email version not found.");
 const name=string(req.body.fromName).trim(),replyTo=string(req.body.replyToEmail).trim(),purpose=string(req.body.purpose);
 if(!name||name.length>191||/[\r\n]/.test(name)||replyTo&&!emailAddress(replyTo)||!Object.values(EmailPurpose).includes(purpose as EmailPurpose))throw new CreateError(400,"Choose a sender name, valid reply-to address and email purpose.");
 const settings=await resolveOrganizationSmtpSettings(org);if(!emailAddress(settings.smtpFromEmail))throw new CreateError(422,"Configure the organization sender address in email transport settings first.");
 await prisma.$transaction(async tx=>{
   await touchCampaign(tx,org,campaign.id,req.body.campaignRevision);
   if(content.revision!==req.body.revision)throw new CreateError(409,"The content changed. Save and refresh before changing email settings.");
   const native=await nativeRecord(org,variant,tx,true);
   if(native?.kind==="EMAIL"&&(native.record.status!=="DRAFT"||native.record.sentAt||native.record.totalRecipients||native.record.scheduledAt))throw new CreateError(409,"Historical email settings are frozen. Duplicate before editing.");
   const changed=await tx.createVariant.updateMany({where:{id:variant.id,revision:variant.revision},data:{documentJson:json({...variantFrom(variant.documentJson),sender:{fromName:name,replyToEmail:replyTo,purpose}}),revision:{increment:1}}});
   if(!changed.count)throw new CreateError(409,"Email settings changed in another session.");
 });
 res.json({saved:true,campaignRevision:campaign.revision+1});
}));
router.post("/contents/:id/studio/send-test",route(async(req,res,org,actor)=>{
 await demand(req,"edit:communications");const {content,campaign}=await contentFor(req,param(req),true);
 if(req.body.confirm!==true||req.body.revision!==content.revision||!emailAddress(req.body.toEmail))throw new CreateError(400,"Review the saved revision and confirm one valid test recipient.");
 const design=await hydrateSourceHtml(req,org,normalizeDesign(content.designJson)),brand=await brandForStudio(org,design,"EMAIL"),donor=await resolveStudioDonor(req,campaign,design,string(req.body.constituentId)||undefined),rendered=renderEmailDocument(design,donor,brand);
 if(rendered.issues.some(issue=>issue.blocking))throw new CreateError(422,rendered.issues.filter(issue=>issue.blocking).map(issue=>issue.message).join("; "));
 const variant=content.variants.find(item=>item.channel==="EMAIL");if(!variant)throw new CreateError(400,"Add the Email channel before sending a test.");const native=await nativeRecord(org,variant,prisma,true);
 const html=absoluteStudioEmail(rendered.html).replace(/\{\{unsubscribeUrl\}\}/g,"#test-unsubscribe").replace(/\{\{preferencesUrl\}\}/g,"#test-preferences"),text=rendered.text.replace(/\{\{unsubscribeUrl\}\}/g,"Test preview only").replace(/\{\{preferencesUrl\}\}/g,"Test preview only");
 const accepted=await(await createOrganizationEmailSender(org)).send({to:string(req.body.toEmail).trim().toLowerCase(),subject:`[TEST] ${rendered.subject||content.name}`,html,text,fromNameOverride:variantFrom(variant.documentJson).sender?.fromName||(native?.kind==="EMAIL"?native.record.fromName:undefined),replyToOverride:variantFrom(variant.documentJson).sender?.replyToEmail||(native?.kind==="EMAIL"?native.record.replyToEmail||undefined:undefined)});
 await prisma.auditLog.create({data:{organizationId:org,userId:actor,action:"CREATE_STUDIO_TEST_ACCEPTED",entity:"CreateContent",entityId:content.id,metadata:{revision:content.revision,toEmail:string(req.body.toEmail).trim().toLowerCase(),providerMessageId:accepted.providerMessageId}}});
 res.json({accepted:true,confirmedDelivered:false,message:"Provider accepted the test message. This does not confirm inbox delivery."});
}));
export function absoluteStudioEmail(html:string){const base=process.env.NEXT_PUBLIC_APP_URL||process.env.FRONTEND_ORIGIN||"http://localhost:3000";return absolutizeEmailAssetUrls(html,base).replace(/(\bhref=")\/(?!\/)([^"<>]*)"/g,(_match,prefix:string,path:string)=>`${prefix}${new URL(`/${path}`,base).toString()}"`);}
export function absoluteStudioText(text:string){const base=process.env.NEXT_PUBLIC_APP_URL||process.env.FRONTEND_ORIGIN||"http://localhost:3000";return text.replace(/(^|[\s(])(\/give\/[a-z0-9_-]+[^\s)]*)/gi,(_match,prefix:string,path:string)=>prefix+new URL(path,base).toString());}
export default router;
