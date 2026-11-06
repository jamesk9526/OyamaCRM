"use client";
/* eslint-disable @next/next/no-img-element -- Social preview renders the exact authored media. */
import { useEffect, useRef, useState } from "react";
import { PanelRightClose } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreate } from "../CreateShell";
import { channelNames, message, type Campaign, type Channel, type Content, type VariantDocument } from "../types";
import type { ArtifactKind, StudioDesign, StudioRender } from "@/server/src/oyama-create/studio/types";
import { dimensions } from "@/server/src/oyama-create/studio/design";
import { studioContentCss, studioRegionCss } from "@/server/src/oyama-create/studio/layout";

type PreviewOutput = StudioRender & { channel: Channel; pageChrome?: { header: string; footer: string } };

function letterPreviewHtml(design: StudioDesign, output: PreviewOutput, artifact: ArtifactKind) {
  if (artifact === "OUTER_ENVELOPE" || artifact === "RETURN_ENVELOPE") {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{position:relative;margin:24px;color:${design.styles.color};font:${design.styles.fontSize}pt/${design.styles.lineHeight} Georgia,serif;overflow-wrap:anywhere}img,table{max-width:100%}table{border-collapse:collapse}</style></head><body>${output.html}</body></html>`;
  }
  const size = dimensions(design.page), { top, right, bottom, left } = design.page.margins;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @font-face{font-family:Inter;src:url('/fonts/inter-latin-variable.woff2') format('woff2');font-weight:100 900}
    @font-face{font-family:'Noto Serif';src:url('/fonts/noto-serif-latin.woff2') format('woff2');font-weight:100 900}
    html,body{margin:0}body{container-type:inline-size}
    .studio-preview-page{box-sizing:border-box;width:min(100%,${size.width}px);margin:auto;padding-inline:${left}in ${right}in;background:${design.styles.background}}
    @supports (zoom:calc(1px / 1px)){.studio-preview-page{width:${size.width}px;zoom:min(1,calc(100cqw / ${size.width}px))}}
    ${studioRegionCss(".studio-preview-region")}
    .studio-preview-region{overflow:hidden}
    ${studioContentCss(design)}
    .studio-content{display:flow-root;min-height:${size.bodyHeight}px}
    </style></head><body><article class="studio-preview-page"><header class="studio-preview-region" style="height:${top}in">${output.pageChrome?.header || ""}</header><main class="studio-content">${output.html}</main><footer class="studio-preview-region" style="height:${bottom}in">${output.pageChrome?.footer || ""}</footer></article></body></html>`;
}

export default function ChannelPreview({content,campaign,design,recipient,formats,readonly,sourcePending=false,active=true,onCollapse,onCustomize,onSettings,onProof,channels,initialChannel}:{content:Content;campaign:Campaign;design:StudioDesign;recipient:string;formats:Partial<Record<Channel,VariantDocument>>;readonly:boolean;sourcePending?:boolean;active?:boolean;onCollapse?:()=>void;onCustomize:(channel:Channel)=>void;onSettings:(channel:Channel)=>void;onProof:(artifact:ArtifactKind)=>void;channels?:Channel[];initialChannel?:Channel}){
  const {permissions}=useCreate();
  const [channel,setChannel]=useState<Channel>(initialChannel||channels?.[0]||campaign.channelsJson[0]||"LETTER"),[mode,setMode]=useState("desktop"),[artifact,setArtifact]=useState<ArtifactKind>("LETTER");
  const [outputs,setOutputs]=useState<Partial<Record<Channel,{key:string;output:PreviewOutput}>>>({}),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const sequence=useRef(0),format=formats[channel]||content.variants.find(item=>item.channel===channel)?.documentJson;
  const requestKey=JSON.stringify([design,recipient,channel,artifact,format]);
  const output=outputs[channel]?.output||null,stale=outputs[channel]?.key!==requestKey;
  useEffect(()=>{
    const current=++sequence.current,controller=new AbortController();
    if(!active)return;
    const timer=setTimeout(()=>{
      setLoading(true);setError("");
      void apiFetch<PreviewOutput>(`/api/oyama-create/contents/${content.id}/studio/preview`,{method:"POST",signal:controller.signal,body:JSON.stringify({design,constituentId:recipient||undefined,channel,artifact,format})})
        .then(value=>{if(current===sequence.current)setOutputs(previous=>({...previous,[channel]:{key:requestKey,output:value}}));})
        .catch(value=>{if(!controller.signal.aborted&&current===sequence.current)setError(message(value));})
        .finally(()=>{if(current===sequence.current)setLoading(false);});
    },350);
    return()=>{clearTimeout(timer);controller.abort();};
  },[design,recipient,content.id,channel,artifact,format,requestKey,active]);
  const permitted=(value:Channel)=>permissions.includes(value==="LETTER"?"letters.view":"view:communications");
  const enabled=campaign.channelsJson.includes(channel),current=output?.channel===channel;
  const proofArtifact = artifact === "REPLY_SLIP" && design.pack.replySlip.placement === "attached" ? "LETTER" : artifact;
  const html = current ? channel === "LETTER" ? letterPreviewHtml(design, output, artifact) : output.html : "";
  return <aside className="cs-live-preview" aria-label="Live channel preview">
    <div className="cs-preview-controls"><div className="cs-preview-heading"><div><h2>Live preview</h2><p>Switch formats while your editor stays in place.</p></div><div className="cs-preview-heading-actions"><span role="status">{sourcePending?"HTML changes awaiting preview":error?"Preview needs attention":loading||stale?"Updating draft preview…":current?"Current draft":"Choose a format"}</span>{onCollapse&&<button type="button" className="oc-icon-button" aria-label="Collapse live preview" title="Collapse live preview" onClick={onCollapse}><PanelRightClose size={16}/></button>}</div></div>
    <div className="cs-preview-tabs" role="tablist" aria-label="Preview channel">{(channels||["LETTER","EMAIL","SOCIAL","WEB","SMS"] as Channel[]).map(value=><button type="button" role="tab" aria-selected={channel===value} disabled={!permitted(value)} title={!permitted(value)?"Channel access is required":undefined} key={value} onClick={()=>{setChannel(value);setMode("desktop");}}>{channelNames[value]}</button>)}</div>
    {!enabled&&<p className="oc-notice">Preview only. Add {channelNames[channel]} in campaign Settings to include it in delivery.</p>}
    <div className="cs-preview-actions">
      {channel==="LETTER"?<><label className="sr-only" htmlFor={`preview-piece-${content.id}`}>Preview letter piece</label><select id={`preview-piece-${content.id}`} value={artifact} onChange={event=>setArtifact(event.target.value as ArtifactKind)}><option value="LETTER">Letter</option><option value="REPLY_SLIP" disabled={!design.pack.replySlip.enabled}>Reply slip</option><option value="OUTER_ENVELOPE" disabled={!design.pack.outerEnvelope.enabled}>Outer envelope</option><option value="RETURN_ENVELOPE" disabled={!design.pack.returnEnvelope.enabled}>Return envelope</option></select>{enabled&&<button type="button" className="oc-button small" onClick={()=>onProof(proofArtifact)}>PDF proof</button>}</>:channel==="EMAIL"?<div role="group" aria-label="Email preview device">{["desktop","mobile","plain-text"].map(value=><button type="button" className="oc-button small" aria-pressed={mode===value} key={value} onClick={()=>setMode(value)}>{value}</button>)}</div>:null}
      {!readonly&&<button type="button" className="oc-button small" onClick={()=>onCustomize(channel)}>Customize {channelNames[channel]}</button>}
      {enabled&&<button type="button" className="oc-button small" onClick={()=>onSettings(channel)}>{channelNames[channel]} settings</button>}
    </div>
    {stale&&output&&<p className="oc-help" role="status">Showing the last successful preview while this draft updates.</p>}
    {error&&<p className="oc-error" role="alert">{error} {output&&"The last successful preview is retained below."}</p>}
    </div><div className="cs-preview-scroll"><div className={`cs-preview-output ${mode==="mobile"?"is-mobile":""}`} aria-busy={loading}>
      {!current?<p className="oc-state">{loading?"Rendering this format…":"Waiting for preview…"}</p>:mode==="plain-text"||channel==="SMS"||channel==="SOCIAL"?<div className={`cs-message-preview cs-message-${channel.toLowerCase()}`}>
        {channel==="SOCIAL"&&<strong>{format?.network==="INSTAGRAM"?"Instagram":"Facebook"}</strong>}
        {channel==="SOCIAL"&&format?.mediaUrl&&<img src={format.mediaUrl} alt="Selected social media"/>}
        <pre>{output.text||"Write a public caption in channel settings."}</pre>
        {channel==="SMS"&&<small>{output.text.length} / 2,048 characters</small>}
      </div>:<iframe title={`${channelNames[channel]} live draft preview`} sandbox="" srcDoc={html}/>}
    </div>
    {current&&output.issues.length>0&&<section className="cs-preview-issues" aria-label="Preview issues"><h3>Before using this format</h3>{output.issues.map((issue,index)=><p className={issue.blocking?"oc-error":"oc-help"} key={`${issue.code}:${index}`}>{issue.message}</p>)}</section>}
    {current&&!!output.adaptations.length&&<details><summary>Format adaptations</summary>{output.adaptations.map((item,index)=><p className="oc-help" key={index}>{item.message}</p>)}</details>}
    </div><p className="oc-help cs-preview-footnote">Preview does not send or publish. Review the final PDF for printed page breaks.</p>
  </aside>;
}
