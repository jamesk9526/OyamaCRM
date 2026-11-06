import { publicCopySafe, type Channel, type VariantDocument } from "../domain.js";
import { channelReviewRequired } from "./design.js";
import { renderStudio, renderEmailDocument, emptyDonor } from "./render.js";
import { renderEnvelope } from "./envelope.js";
import type { ArtifactKind, BrandDocument, DonorContext, StudioDesign, StudioRender } from "./types.js";

/** One projection contract for draft preview, readiness and frozen release output. */
export function renderChannel(design:StudioDesign,donor:DonorContext,brand:BrandDocument,channel:Channel,format:VariantDocument,artifact:ArtifactKind="LETTER"):StudioRender{
  if(channel==="EMAIL")return renderEmailDocument(design,donor,brand);
  if(channel==="LETTER"){
    if(artifact==="OUTER_ENVELOPE"||artifact==="RETURN_ENVELOPE")return {...renderEnvelope(design,donor,brand,artifact,true),adaptations:[],decisions:[]};
    return renderStudio(design,donor,brand,{channel:"LETTER",artifact,sample:!donor.available});
  }
  const rendered=renderStudio(design,emptyDonor(donor.asOf),brand,{channel});
  if(!publicCopySafe({version:1,blocks:[]},format))rendered.issues.push({code:"PRIVATE_CHANNEL",message:"Public channel settings cannot contain recipient merge fields.",blocking:true,channel});
  if(channel==="SMS"||channel==="SOCIAL"){
    if(format.caption.trim()&&!(design.version===4&&design.channels?.[channel])){
      rendered.text=format.caption;rendered.html="";
      // An explicit literal caption replaces the private letter projection entirely.
      rendered.issues=publicCopySafe({version:1,blocks:[]},format)?[]:[{code:"PRIVATE_CHANNEL",message:"Public channel settings cannot contain recipient merge fields.",blocking:true,channel}];
    }else if(!design.channels?.[channel])rendered.issues.push({code:"PUBLIC_COPY_REQUIRED",message:"Write and review a public caption for this channel.",blocking:true,channel});
    if(channel==="SMS"&&rendered.text.length>2048)rendered.issues.push({code:"SMS_LENGTH",message:"SMS exceeds 2,048 characters. Shorten its caption.",blocking:true,channel});
    if(channel==="SOCIAL"&&format.network==="INSTAGRAM"&&!format.mediaUrl)rendered.issues.push({code:"SOCIAL_MEDIA",message:"Instagram requires a public image. Choose media in channel settings.",blocking:true,channel});
  }
  if(channelReviewRequired(design,channel)&&!rendered.issues.some(issue=>issue.code==="CHANNEL_REVIEW"))rendered.issues.push({code:"CHANNEL_REVIEW",message:"Review this adaptation after shared content changes.",blocking:true,channel});
  return rendered;
}
