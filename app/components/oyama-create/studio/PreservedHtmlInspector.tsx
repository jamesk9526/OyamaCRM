"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { sanitizeStudioHtml } from "@/server/src/oyama-create/studio/html";
import { message } from "../types";
export default function PreservedHtmlInspector({html,sourceRevisionId,patch}:{html:string;sourceRevisionId:string;patch:(value:Record<string,unknown>)=>void}){
  const [draft,setDraft]=useState(html),[original,setOriginal]=useState(html),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!sourceRevisionId){setDraft(html);setOriginal(html);return;}let active=true;setBusy(true);void apiFetch<{html:string}>(`/api/oyama-create/imports/revisions/${sourceRevisionId}`).then(value=>{if(active){setDraft(value.html);setOriginal(value.html);}}).catch(error=>{if(active)setError(message(error));}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[sourceRevisionId,html]);
  async function apply(review=false){
    setBusy(true);setError("");try{
      const safe=sanitizeStudioHtml(draft);
      if(sourceRevisionId){const next=await apiFetch<{id:string}>(`/api/oyama-create/imports/revisions/${sourceRevisionId}/html`,{method:"POST",body:JSON.stringify({html:safe})});patch({sourceRevisionId:next.id,html:"",reviewedHtml:review?next.id:""});}
      else patch({html:safe,reviewedHtml:review?safe:""});
    }catch(error){setError(message(error));}finally{setBusy(false);}
  }
  return <section className="oc-form"><p className="oc-help">This layout is preserved as HTML. Compare its appearance before marking it reviewed. Editing here changes the Create draft; the legacy original remains in source history.</p>
    {error&&<p role="alert" className="oc-error">{error}</p>}
    <label>Preserved HTML<textarea aria-label="Preserved HTML source" rows={12} value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)}/></label>
    <details><summary>Compare original and edited layout</summary><h4>Original</h4><iframe title="Preserved original block" sandbox="" srcDoc={sanitizeStudioHtml(original)}/><h4>Edited</h4><iframe title="Edited preserved block" sandbox="" srcDoc={sanitizeStudioHtml(draft)}/></details>
    <button type="button" className="oc-button" disabled={busy} onClick={()=>void apply()}>Apply HTML changes</button><button type="button" className="oc-button primary" disabled={busy} onClick={()=>void apply(true)}>I reviewed this HTML layout</button>
  </section>;
}
