"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Code2, Download } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StudioDesign } from "@/server/src/oyama-create/studio/types";
import type { HtmlScope } from "@/server/src/oyama-create/studio/html-document";
import type { EditorHandle } from "../SharedEditor";
import { message } from "../types";
export type HtmlSession={html:string;revision:number;fingerprint:string;scope:HtmlScope};
type Projection={design:StudioDesign;diagnostics:string[]};
const HtmlDocumentEditor=forwardRef<EditorHandle,{contentId:string;session:HtmlSession;readonly:boolean;onDirty:(value:boolean)=>void;onPreview:(value:StudioDesign|null,pending:boolean)=>void;onApply:(value:StudioDesign)=>Promise<boolean>;onCancel:()=>void}>(function HtmlDocumentEditor({contentId,session,readonly,onDirty,onPreview,onApply,onCancel},ref){
  const [html,setHtml]=useState(session.html),[busy,setBusy]=useState(false),[error,setError]=useState(""),[diagnostics,setDiagnostics]=useState<string[]>([]);
  const dirty=html!==session.html,callbacks=useRef({onDirty,onPreview,onApply});callbacks.current={onDirty,onPreview,onApply};
  const sequence=useRef(0),pendingSave=useRef<Promise<boolean>|null>(null);
  const convert=useCallback((value:string,signal?:AbortSignal)=>apiFetch<Projection>(`/api/oyama-create/contents/${contentId}/studio/html`,{method:"POST",signal,body:JSON.stringify({...session,action:"CONVERT",html:value})}),[contentId,session]);
  useEffect(()=>{callbacks.current.onDirty(dirty);},[dirty]);
  useEffect(()=>{
    const current=++sequence.current,controller=new AbortController();
    if(!dirty){callbacks.current.onPreview(null,false);return;}
    callbacks.current.onPreview(null,true);
    const timer=setTimeout(()=>{void convert(html,controller.signal).then(result=>{if(current===sequence.current){setError("");setDiagnostics(result.diagnostics);callbacks.current.onPreview(result.design,false);}}).catch(error=>{if(!controller.signal.aborted&&current===sequence.current){setError(message(error));callbacks.current.onPreview(null,true);}});},400);
    return()=>{clearTimeout(timer);controller.abort();};
  },[html,dirty,convert]);
  const apply=useCallback(async()=>{
    if(pendingSave.current)return pendingSave.current;
    if(readonly)return !dirty;
    if(!dirty){onCancel();return true;}
    setBusy(true);setError("");
    const pending=(async()=>{try{const result=await convert(html);setDiagnostics(result.diagnostics);return await callbacks.current.onApply(result.design);}catch(error){setError(message(error));return false;}finally{setBusy(false);pendingSave.current=null;}})();pendingSave.current=pending;return pending;
  },[convert,html,dirty,readonly,onCancel]);
  useImperativeHandle(ref,()=>({flush:apply}),[apply]);
  function download(){const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="letter-source.html";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="cs-html-editor" aria-label="Whole letter HTML editor">
    <header className="cs-html-heading"><div><strong><Code2 size={15}/>Letter HTML</strong><p>{session.scope==="SHARED"?"Edits update shared content and linked channels.":`Edits apply to the protected ${session.scope.toLowerCase()} version.`} Region markers keep headers and footers separate. CRM block markers keep their settings and merge fields.</p></div><button type="button" className="oc-button small" onClick={download}><Download size={13}/>Download HTML</button></header>
    {error&&<p className="oc-error" role="alert">{error}</p>}
    {!!diagnostics.length&&<details className="cs-html-diagnostics"><summary>Conversion notes ({diagnostics.length})</summary>{diagnostics.map((value,index)=><p key={index}>{value}</p>)}</details>}
    <textarea aria-label="Whole letter HTML source" value={html} onChange={event=>setHtml(event.target.value)} readOnly={readonly||busy} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();void apply();}}}/>
    <footer className="cs-html-actions"><span role="status">{busy?"Applying HTML…":dirty?"Unapplied HTML · draft preview updates automatically":"HTML matches the saved draft"}</span><div className="oc-actions"><button type="button" className="oc-button small" disabled={busy} onClick={onCancel}>Cancel HTML editing</button><button type="button" className="oc-button small primary" disabled={readonly||busy||!dirty} onClick={()=>void apply()}>Apply HTML</button></div></footer>
  </section>;
});
export default HtmlDocumentEditor;
