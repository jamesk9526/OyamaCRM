import type { Request } from "express";
import type { CreateCampaign, CreateContent, CreateVariant } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { metaAccount } from "../providers.js";
import { demand } from "../access.js";
import { absoluteStudioEmail, absoluteStudioText } from "./email.js";
import { nativeRecord, emailRecordSharing } from "../legacy.js";
import { CreateError, documentFrom, publicCopySafe, variantFrom, type Channel, type PlannedRecipient } from "../domain.js";
import type { FrozenContent, FrozenVariant } from "../releases.js";
import type { LetterSnapshot } from "../../services/letter-production-contract.js";
import { defaultDesign, normalizeDesign, emailReviewRequired, walkNodes } from "./design.js";
import { hydrateSourceHtml } from "./source-html.js";
import { renderChannel } from "./channel-render.js";
import { brandForStudio } from "./brand-service.js";
import { printFontAssets } from "./print-fonts.js";
import { renderRegion, renderStudio, renderEmailDocument, emptyDonor, designSensitive, regionIssues } from "./render.js";
import { resolveStudioDonor } from "./donor.js";
import { freezeStudioPrint } from "./print.js";
import { managedAssetIssues } from "./asset-files.js";
import type { BrandDocument, StudioDesign, ArtifactKind } from "./types.js";
export type FrozenStudio = { design: StudioDesign; brand: BrandDocument; templateId: string; channelBrands?: Partial<Record<Channel,BrandDocument>> };
export async function prepareStudioRelease(req: Request, campaign: CreateCampaign, content: CreateContent & { variants: CreateVariant[] }, recipients: PlannedRecipient[], classicLetter = false) {
  const design = await hydrateSourceHtml(req,campaign.organizationId,normalizeDesign(content.designJson)), brand = await brandForStudio(campaign.organizationId, design), issues: Array<{channel:string;message:string}> = [];
  if(design.version===4&&(campaign.channelsJson as string[]).includes("LETTER")){
    const fonts=await printFontAssets(design,(["firstHeader","header","firstFooter","footer"] as const).map(key=>renderRegion(design,emptyDonor(),brand,key)));
    issues.push(...fonts.issues.map(issue=>({channel:"LETTER",message:issue.message})));
  }
  if (classicLetter ? (campaign.channelsJson as Channel[]).includes("EMAIL") && designSensitive({ ...design, body: design.channels?.EMAIL?.document || design.body, channels: undefined, pack: { ...design.pack, replySlip: { ...design.pack.replySlip, content: { type: "doc", content: [] } } }, regions: defaultDesign().regions }) : designSensitive(design)) await demand(req, "letters.view_sensitive_merge_data");
  if (recipients.length > 1500) throw new CreateError(422, "Studio releases support up to 1,500 channel deliveries per content piece. Split a larger audience into reviewed releases.");
  if (!classicLetter && walkNodes(design.body).some(node=>node.type==="studioLegacy")) issues.push({channel:"ALL",message:`${content.name}: review the preserved original's structured conversion.`});
  const letter = content.variants.find(item=>item.channel==="LETTER"), native = letter ? await nativeRecord(campaign.organizationId,letter,prisma,true) : null;
  const pendingImports=await prisma.createImportSource.findMany({where:{organizationId:campaign.organizationId,contentId:content.id,...(classicLetter?{sourceType:{not:"LETTER"}}:{}),status:{in:["NEEDS_REVIEW","SOURCE_CHANGED","FAILED"]}}});
  for(const source of pendingImports)issues.push({channel:"ALL",message:`${source.name}: review its imported conversion or legacy changes before release.`});
  if((campaign.channelsJson as string[]).includes("LETTER")&&native?.kind!=="LETTER")issues.push({channel:"LETTER",message:"Use this retained letter as a new draft to create its print template before approval."});
  const settings = await prisma.organizationSettings.findUnique({where:{organizationId:campaign.organizationId}});
  const item: FrozenContent = {id:content.id,name:content.name,revision:content.revision,document:documentFrom(content.documentJson),scheduledAt:(content.scheduledAt||campaign.startsAt||new Date()).toISOString(),variants:[],studio:{design,brand,templateId:native?.record.id||""}};
  const channelBrands:Partial<Record<Channel,BrandDocument>>={};
  const assetCache=new Map<string,Promise<boolean>>();
  for(const channel of campaign.channelsJson as Channel[]){
    const source=content.variants.find(item=>item.channel===channel);if(source&&variantFrom(source.documentJson).enabled===false)continue;if(!source){issues.push({channel,message:"Channel version is missing."});continue;}
    const format=variantFrom(source.documentJson), channelBrand=await brandForStudio(campaign.organizationId,design,channel);channelBrands[channel]=channelBrand;
    const rendered=renderChannel(design,emptyDonor(),channelBrand,channel,format);
    if (source.letterAdaptationJson && !rendered.text.trim() && !/<img\b/i.test(rendered.html)) issues.push({ channel, message: "Add copy for this converted format before approval." });
    rendered.issues.push(...await managedAssetIssues(campaign.organizationId,rendered.html,assetCache));
    const bound=await nativeRecord(campaign.organizationId,source,prisma,true);
    if(bound&&bound.fingerprint!==source.legacyFingerprint)issues.push({channel,message:"The legacy source was edited separately. Review and reconcile its changes before this release."});
    const deliveryFormat = (channel === "SMS" || channel === "SOCIAL") && design.version === 4 && design.channels?.[channel] ? { ...format, caption: rendered.text } : format;
    const version:FrozenVariant={channel,revision:source.revision,format:deliveryFormat,html:rendered.html,text:rendered.text,nativeFingerprint:bound?.fingerprint||null};
    if(channel==="EMAIL"){
      if(!design.channels?.EMAIL&&emailReviewRequired(design))issues.push({channel,message:"Review customized email blocks against the latest letter design."});
      const email=bound?.kind==="EMAIL"?bound.record:null;
      if(email&&(email.status!=="DRAFT"||email.sentAt||email.totalRecipients))issues.push({channel,message:"Duplicate the historical email before using it in a Studio release. Sent messages remain frozen."});
      version.sourceSharing=email?emailRecordSharing(email):{ownerId:req.user!.sub,sharedWithOrganization:false};
      version.email={name:content.name,subject:design.email.subject||format.subject||content.name,purpose:format.sender?.purpose||email?.purpose||"MARKETING",previewText:design.email.previewText,fromName:format.sender?.fromName||email?.fromName||settings?.smtpFromName||"",fromEmail:settings?.smtpFromEmail||email?.fromEmail||"",replyToEmail:format.sender?.replyToEmail||email?.replyToEmail||settings?.smtpFromEmail||null,bodyHtml:rendered.html,bodyText:rendered.text,templateJson:null};
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(version.email.fromEmail))issues.push({channel,message:"Configure a valid organization sender email."});
      if(!version.email.fromName.trim())issues.push({channel,message:"Configure the organization sender name."});
      for(const issue of rendered.issues.filter(issue=>issue.blocking&&issue.code==="EMAIL_ADDRESS"))issues.push({channel,message:issue.message});
    }
    if(channel==="WEB"&&!design.channels?.WEB)issues.push({channel,message:"Create and review a dedicated public content piece for this Studio appeal. Rich print content and donor fields cannot use the legacy plain-copy projection."});
    if(["WEB","SMS","SOCIAL"].includes(channel)){
      if(!publicCopySafe({version:1,blocks:[]},format))issues.push({channel,message:"Use literal public copy without private recipient merge fields."});
      if(channel==="WEB"){
        if(format.formEnabled&&!format.consentText.trim())issues.push({channel,message:"Provide the exact public form consent wording in Web settings."});
        const privateIssues=rendered.issues.filter(issue=>issue.blocking);for(const issue of privateIssues)issues.push({channel,message:issue.message});
        // The existing public page contract remains explicit plain shared copy until a reviewed web design is provided.
        if(!design.channels?.WEB&&design.body.content.some(node=>!["paragraph","heading","image","horizontalRule","letterPageBreak","letterSpacer"].includes(node.type)))issues.push({channel,message:"This rich letter includes blocks requiring a separate reviewed web adaptation. Use a dedicated public content piece."});
      }else if(!format.caption.trim()&&!design.channels?.[channel])issues.push({channel,message:"Write and review an explicit public caption for this rich letter; private donor blocks never become message text."});
      if(source.needsReview)issues.push({channel,message:"Review the public channel after changes to the Studio design."});
      if(channel==="SOCIAL"){
        const connection=await prisma.createConnection.findFirst({where:{organizationId:campaign.organizationId,provider:"META"}});
        if(connection?.readyAt)try{const account=metaAccount(connection,format.accountId);if(format.network==="INSTAGRAM"&&(!account.account.instagramId||!connection.configJson||typeof connection.configJson!=="object"||Array.isArray(connection.configJson)||connection.configJson.instagramReady!==true||!format.mediaUrl))issues.push({channel,message:"Instagram requires a verified professional account, publishing scope and a public image."});}catch(error){issues.push({channel,message:error instanceof Error?error.message:"Choose a verified social account."});}
      }
    }
    for(const issue of rendered.issues.filter(issue=>issue.blocking&&["HTML_REVIEW","SOURCE_HTML","CHANNEL_REVIEW","PUBLIC_COPY_REQUIRED","SMS_LENGTH","SOCIAL_MEDIA","PRIVATE_CHANNEL","IMAGE_MISSING","MERGE_ATTRIBUTE"].includes(issue.code)))issues.push({channel,message:issue.message});
    item.variants.push(version);
  }
  item.studio!.channelBrands=channelBrands;
  const unique=new Map(recipients.map(item=>[item.member.constituentId||item.key,item]));
  for(const recipient of unique.values()){
    const donor=await resolveStudioDonor(req,campaign,design,recipient.member.constituentId||undefined);
    for(const channel of [...new Set(recipients.filter(item=>(item.member.constituentId||item.key)===(recipient.member.constituentId||recipient.key)).map(item=>item.channel))]){
      if(channel!=="EMAIL"&&channel!=="LETTER")continue;
      const result=channel==="EMAIL"?renderEmailDocument(design,donor,channelBrands.EMAIL||brand):renderStudio(design,donor,channelBrands.LETTER||brand,{channel:"LETTER"});
      result.issues.push(...await managedAssetIssues(campaign.organizationId,result.html,assetCache));
      if(channel==="LETTER")result.issues.push(...regionIssues(design,donor,brand));
      for(const issue of result.issues.filter(item=>item.blocking))if(!issues.some(item=>item.channel===channel&&item.message===issue.message))issues.push({channel,message:`${donor.name||recipient.key}: ${issue.message}`});
    }
  }
  return {item,issues};
}
export async function freezeStudioRecipient(req:Request,campaign:CreateCampaign,content:FrozenContent,recipient:PlannedRecipient,code:string){
  if(!content.studio)throw new CreateError(422,"The frozen Studio design is missing.");
  const {design,templateId}=content.studio,brand=content.studio.channelBrands?.[recipient.channel]||content.studio.brand,donor=await resolveStudioDonor(req,campaign,design,recipient.member.constituentId||undefined);donor.responseCode=code;
  const email=recipient.channel==="EMAIL"?renderEmailDocument(design,donor,brand):null;
  if(email?.issues.some(issue=>issue.blocking))throw new CreateError(422,email.issues.filter(issue=>issue.blocking).map(issue=>issue.message).join("; "));
  const artifacts:Array<{kind:ArtifactKind;snapshot:LetterSnapshot}>=[];
  if(recipient.channel==="LETTER"){
    const kinds:ArtifactKind[]=["LETTER"];if(design.pack.replySlip.enabled&&design.pack.replySlip.placement==="separate")kinds.push("REPLY_SLIP");if(design.pack.outerEnvelope.enabled)kinds.push("OUTER_ENVELOPE");if(design.pack.returnEnvelope.enabled)kinds.push("RETURN_ENVELOPE");
    for(const kind of kinds){const studio=await freezeStudioPrint(campaign.organizationId,design,donor,brand,kind);if(studio.issues.some(issue=>issue.blocking))throw new CreateError(422,studio.issues.filter(issue=>issue.blocking).map(issue=>issue.message).join("; "));artifacts.push({kind,snapshot:{version:2,organizationId:campaign.organizationId,templateId,revision:content.revision,title:`${content.name} · ${kind}`,subject:content.name,bodyHtml:studio.html,generatedAt:donor.asOf,recipientId:donor.constituentId,recipient:{name:donor.name,addressLine1:recipient.member.addressLine1,addressLine2:recipient.member.addressLine2,city:recipient.member.city,state:recipient.member.state,zip:recipient.member.zip},branding:{},header:{},footer:{},signature:{},layout:{paper:"Letter",margins:studio.margins},assets:studio.assets,warnings:[],blockers:[],studio}});}
  }
  return {donor,email:email?{html:absoluteStudioEmail(email.html),text:absoluteStudioText(email.text),subject:email.subject||content.name}:null,artifacts};
}
