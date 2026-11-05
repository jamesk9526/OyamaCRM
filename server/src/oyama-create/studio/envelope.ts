import { escapeHtml } from "../domain.js";
import type { BrandDocument, DonorContext, StudioDesign, StudioIssue } from "./types.js";

/** Pure envelope layout shared by live previews and frozen print artifacts. */
export function renderEnvelope(design:StudioDesign,donor:DonorContext,brand:BrandDocument,kind:"OUTER_ENVELOPE"|"RETURN_ENVELOPE",sample=false){
  const envelope=design.pack[kind==="OUTER_ENVELOPE"?"outerEnvelope":"returnEnvelope"];
  const [width,height]=envelope.size==="DL"?[220/25.4,110/25.4]:envelope.size==="#9"?[8.875,3.875]:[9.5,4.125];
  const sender=[brand.identity.organizationDisplayName,brand.identity.streetAddress1,brand.identity.streetAddress2,[brand.identity.city,brand.identity.stateProvince,brand.identity.postalCode].filter(Boolean).join(" ")].filter(Boolean).join("\n");
  const recipient=[donor.name,donor.address].filter(Boolean).join("\n"),address=kind==="OUTER_ENVELOPE"?recipient:sender;
  const issues:StudioIssue[]=[];
  if(!address||kind==="OUTER_ENVELOPE"&&(!donor.available||!donor.address))issues.push({code:"ENVELOPE_ADDRESS",message:"Choose a recipient with a mailing address before production.",blocking:true});
  if(envelope.addressX+envelope.offsetX<0||envelope.addressY+envelope.offsetY<0||envelope.addressX+envelope.offsetX+envelope.addressWidth>width||envelope.addressY+envelope.offsetY+.9>height)issues.push({code:"ENVELOPE_BOUNDS",message:"The address position exceeds the envelope. Adjust offsets or width.",blocking:true});
  const html=`<div style="position:absolute;left:.35in;top:.3in;font-size:9pt;white-space:pre-line">${escapeHtml(kind==="RETURN_ENVELOPE"?recipient:sender)}</div><div style="position:absolute;left:${envelope.addressX+envelope.offsetX}in;top:${envelope.addressY+envelope.offsetY}in;width:${envelope.addressWidth}in;min-height:.9in;white-space:pre-line;${sample&&envelope.window?"border:1px dashed #9caec2;":""}">${escapeHtml(address)}</div>`;
  return {html,text:[sender,recipient].filter(Boolean).join("\n\n"),width,height,issues};
}
