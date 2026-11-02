"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import LetterEditor from "./LetterEditor";
import LetterFormattingToolbar from "./LetterFormattingToolbar";
import LetterProofViewer from "./LetterProofViewer";
import "./letter-production.css";

type Template = { id: string; name: string; category: string; printSubject: string; printBody: string; documentJson?: JSONContent; documentSchemaVersion: number; revision: number; printLayoutJson: unknown };
type Job = { id: string; status: string; error?: string; revision: number; recipient?: { name: string }; pageCount?: number };
export default function ProductionBuilder({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [body, setBody] = useState<{html:string;json:JSONContent} | null>(null);
  const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [dirty,setDirty] = useState(false); const [accepted,setAccepted] = useState(false);
  const [recipient,setRecipient] = useState(""); const [contacts,setContacts] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [job,setJob] = useState<Job | null>(null); const [url,setUrl] = useState<string | null>(null);
  const [tab,setTab] = useState("write"); const serial=useRef(0); const edits=useRef(0);
  useEffect(() => { let active=true; void Promise.all([
    templateId ? apiFetch<Template>(`/api/letters/templates/${templateId}`) : Promise.resolve({id:"",name:"Untitled letter",category:"GENERAL",printSubject:"",printBody:"<p></p>",documentSchemaVersion:2,revision:0,printLayoutJson:{}} as Template),
    apiFetch<Array<{id:string;firstName:string;lastName:string}>>("/api/constituents?limit=all")
  ]).then(([value,people]) => {if(active){setTemplate(value);setContacts(people);setAccepted(value.documentSchemaVersion===2);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;serial.current++;};},[templateId]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  const ready=useCallback((value:Editor)=>{setEditor(value);setBody({html:value.getHTML(),json:value.getJSON()});},[]);
  async function save() {
    if(!template||!body||!accepted)return;
    setBusy(true);setError(""); const savingEdit=edits.current;
    try {const saved=await apiFetch<Template>(`/api/letters/production/templates${template.id?`/${template.id}`:""}`,{method:template.id?"PATCH":"POST",body:JSON.stringify({...template,printBody:body.html,documentJson:body.json})});setTemplate(current=>edits.current===savingEdit?saved:{...current!,id:saved.id,revision:saved.revision});setDirty(edits.current!==savingEdit);return edits.current===savingEdit?saved:undefined;}
    catch(e){setError(e instanceof Error?e.message:"Save failed. Your draft remains in the editor.");}finally{setBusy(false);}
  }
  async function proof(){
    const saved=dirty||!template?.id?await save():template;if(!saved)return;
    const request=++serial.current;setBusy(true);setError("");
    try{let next=await apiFetch<Job>("/api/letters/production/jobs",{method:"POST",body:JSON.stringify({templateId:saved.id,revision:saved.revision,constituentId:recipient})});
      const deadline=Date.now()+90000;
      while(["PENDING","RENDERING"].includes(next.status)&&Date.now()<deadline){if(request!==serial.current)return;setJob(next);await new Promise(resolve=>setTimeout(resolve,1000));next=await apiFetch<Job>(`/api/letters/production/jobs/${next.id}`);}
      if(request!==serial.current)return;setJob(next);
      if(next.status!=="READY")throw new Error(next.error||"The proof is still queued. Check that the production worker is running, then retry.");
      const response=await apiFetchResponse(`/api/letters/production/artifacts/${next.id}/pdf`);if(!response.ok)throw new Error("The PDF could not be loaded.");
      const blob=await response.blob();if(request===serial.current)setUrl(URL.createObjectURL(blob));
    }catch(e){if(request===serial.current)setError(e instanceof Error?e.message:"Proof failed.");}finally{if(request===serial.current)setBusy(false);}
  }
  if(!template)return <div className="p-6" role="status">{error||"Loading letter…"}</div>;
  return <main className="min-w-0 space-y-3 bg-blue-50/50 p-3 sm:p-5">
    <header className="flex flex-wrap items-center gap-3"><input aria-label="Letter name" className="min-w-0 flex-1 rounded border p-2 text-lg font-semibold" value={template.name} onChange={e=>{edits.current++;setTemplate({...template,name:e.target.value});setDirty(true);}}/><span role="status" className="text-xs">{busy?"Working…":dirty?"Unsaved changes":`Revision ${template.revision}`}</span><button disabled={busy||!accepted} onClick={()=>void save()} className="rounded border bg-white px-4 py-2">Save</button><button disabled={busy||!accepted} onClick={()=>void proof()} className="rounded bg-blue-700 px-4 py-2 text-white">Render proof</button></header>
    {!accepted&&<div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">This legacy letter will be converted to structured content. Review formatting and the PDF before using it. The original remains saved until you save this conversion.<button onClick={()=>setAccepted(true)} className="ml-3 underline">Review conversion in editor</button></div>}
    {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <label className="block text-sm">Proof recipient<select value={recipient} onChange={e=>{setRecipient(e.target.value);serial.current++;setJob(null);setBusy(false);}} className="ml-2 max-w-full rounded border bg-white p-2"><option value="">Sample proof</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></label>
    <div className="flex gap-2 lg:hidden">{["write","proof"].map(value=><button key={value} onClick={()=>setTab(value)} className="rounded border bg-white px-4 py-2">{value==="write"?"Write":"Proof"}</button>)}</div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <section className={`${tab==="write"?"block":"hidden"} min-w-0 rounded-lg border bg-white lg:block`}><LetterFormattingToolbar editor={editor} onImage={()=>{const source=window.prompt("Image URL from this organization's uploaded letter media");if(source)editor?.chain().focus().setImage({src:source}).run();}}/><div className="p-6"><LetterEditor initialContent={template.documentJson||template.printBody} onReady={ready} onChange={(html,json)=>{edits.current++;setBody({html,json});setDirty(true);}}/></div></section>
      <div className={`${tab==="proof"?"block":"hidden"} min-w-0 lg:block`}><LetterProofViewer url={url} stale={dirty||!job||job.revision!==template.revision} busy={busy} label={job?.recipient?.name||"Selected recipient"}/></div>
    </div>
  </main>;
}
