"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import LetterEditor from "./LetterEditor";
import LetterFormattingToolbar from "./LetterFormattingToolbar";
import LetterProofViewer from "./LetterProofViewer";
import { BuilderButton, BuilderCard, BuilderStatus, BlockLibrary, MergeFieldLibrary, ReviewChecklist, insertLetterBlock } from "./LetterBuilderKit";
import LetterDocumentSettings from "./LetterDocumentSettings";
import Link from "next/link";
import { ArrowLeft, Eye, Save, Settings2, FileText, Blocks } from "lucide-react";
import "./letter-production.css";
import type { NativeEditorState } from "@/app/components/oyama-email/EmailBuilderKit";

type Template = { id: string; name: string; category: string; printSubject: string; printBody: string; documentJson?: JSONContent; documentSchemaVersion: number; revision: number; printLayoutJson: unknown };
type Job = { id: string; status: string; error?: string; revision: number; recipient?: { name: string }; pageCount?: number };
export default function ProductionBuilder({ templateId, returnHref = "/oyama-letters/templates", onEditorState, onSaved }: { templateId?: string; returnHref?: string; onEditorState?: (value: NativeEditorState) => void; onSaved?: () => Promise<unknown> }) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [contactAttempt, setContactAttempt] = useState(0);
  const [contactError, setContactError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [inspector, setInspector] = useState("document");
  const [sections, setSections] = useState<Array<{label:string;fields:string[]}>>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const proofSection = useRef<HTMLElement>(null);
  useEffect(() => { let active = true; void apiFetch<{sections:Array<{label:string;fields:string[]}>}>("/api/letters/merge-fields").then(value => {if(active)setSections(value.sections);}).catch(() => {}); return () => {active=false;}; }, []);
  const [template, setTemplate] = useState<Template | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [body, setBody] = useState<{html:string;json:JSONContent} | null>(null);
  const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  const [dirty,setDirty] = useState(false); const [accepted,setAccepted] = useState(false);
  const [recipient,setRecipient] = useState(""); const [contacts,setContacts] = useState<Array<{id:string;firstName:string;lastName:string}>>([]);
  const [proofIdentity, setProofIdentity] = useState<{revision:number;recipient:string}|null>(null);
  const proofAbort = useRef<AbortController | null>(null);
  const [job,setJob] = useState<Job | null>(null); const [url,setUrl] = useState<string | null>(null);
  const [tab,setTab] = useState("write"); const serial=useRef(0); const edits=useRef(0);
  useEffect(() => {
    let active=true; const requests=serial;
    setTemplate(null); setError(""); setBusy(false); setBody(null); setDirty(false); setJob(null); setUrl(null); setProofIdentity(null); setRecipient("");
    const load = templateId ? apiFetch<Template>(`/api/letters/templates/${templateId}`) : Promise.resolve({id:"",name:"Untitled letter",category:"GENERAL",printSubject:"",printBody:"<p></p>",documentSchemaVersion:2,revision:0,printLayoutJson:{}} as Template);
    void load.then(value=>{if(active){setTemplate(value);setAccepted(value.documentSchemaVersion===2);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"The letter could not be loaded.");});
    return()=>{active=false;requests.current++;proofAbort.current?.abort();};
  },[templateId,loadAttempt]);
  useEffect(() => {
    let active=true; setContactError("");
    void apiFetch<Array<{id:string;firstName:string;lastName:string}>>("/api/constituents?limit=all").then(people=>{if(active)setContacts(people);}).catch(()=>{if(active)setContactError("Recipients could not be loaded. You can keep editing and render a sample proof.");});
    return()=>{active=false;};
  },[contactAttempt]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!url) return;
    setTab("proof");
    const frame = window.requestAnimationFrame(() => proofSection.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [url]);
  const ready=useCallback((value:Editor)=>{setEditor(value);setBody({html:value.getHTML(),json:value.getJSON()});},[]);
  async function save() {
    if(!template||!body||!accepted)return;
    setBusy(true);setError(""); const savingEdit=edits.current;
    try {const saved=await apiFetch<Template>(`/api/letters/production/templates${template.id?`/${template.id}`:""}`,{method:template.id?"PATCH":"POST",body:JSON.stringify({...template,printBody:body.html,documentJson:body.json})});setTemplate(current=>edits.current===savingEdit?saved:{...current!,id:saved.id,revision:saved.revision});setDirty(edits.current!==savingEdit);await onSaved?.();return edits.current===savingEdit?saved:undefined;}
    catch(e){setError(e instanceof Error?e.message:"Save failed. Your draft remains in the editor.");}finally{setBusy(false);}
  }
  async function proof(){
    proofAbort.current?.abort();
    const controller = new AbortController(); proofAbort.current = controller;
    const request=++serial.current;
    const selectedRecipient=recipient;
    const saved=dirty||!template?.id?await save():template;if(!saved||request!==serial.current)return;
    setBusy(true);setError("");
    const timeout=window.setTimeout(()=>controller.abort(),90000);
    try{
      let next=await apiFetch<Job>("/api/letters/production/jobs",{method:"POST",signal:controller.signal,body:JSON.stringify({templateId:saved.id,revision:saved.revision,constituentId:selectedRecipient})});
      while(["PENDING","RENDERING"].includes(next.status)){
        if(request!==serial.current)return;
        setJob(next);
        await new Promise<void>((resolve,reject)=>{
          const abort=()=>{window.clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));};
          const timer=window.setTimeout(()=>{controller.signal.removeEventListener("abort",abort);resolve();},1000);
          if(controller.signal.aborted)abort();else controller.signal.addEventListener("abort",abort,{once:true});
        });
        next=await apiFetch<Job>(`/api/letters/production/jobs/${next.id}`,{signal:controller.signal});
      }
      if(request!==serial.current)return;setJob(next);
      if(next.status!=="READY")throw new Error(next.error||"The proof could not be rendered. Review the document and retry.");
      const response=await apiFetchResponse(`/api/letters/production/artifacts/${next.id}/pdf`,{signal:controller.signal});
      if(!response.ok)throw new Error("The PDF could not be loaded.");
      const blob=await response.blob();
      if(!blob.size||!response.headers.get("Content-Type")?.includes("application/pdf"))throw new Error("The render did not return a valid PDF.");
      if(request===serial.current){setProofIdentity({revision:saved.revision,recipient:selectedRecipient});setUrl(URL.createObjectURL(blob));}
    }catch(e){if(request===serial.current)setError(controller.signal.aborted?"Proof rendering timed out. Check the worker and try Preview again.":e instanceof Error?e.message:"Proof failed.");}
    finally{window.clearTimeout(timeout);if(request===serial.current)setBusy(false);}
  }
  function insert(id:string){
    if(!editor)return;
    if(id==="image"){if(!uploadInFlight.current)imageInput.current?.click();return;}
    if(id==="signature"){setInspector("document");return;}
    insertLetterBlock(editor,id);
  }
  useEffect(() => { onEditorState?.({ dirty, save: async () => !dirty || !busy && !!await save() }); });
  async function upload(file:File){
    if(!editor||uploadInFlight.current)return;
    uploadInFlight.current=true;setUploading(true);setError("");
    try{
      if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5000000)throw new Error("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const result=await apiFetch<{url:string}>("/api/letters/media",{method:"POST",body:JSON.stringify({fileName:file.name,mimeType:file.type,dataBase64:data,purpose:"editor"})});
      if (!editor.isDestroyed) editor.chain().focus().setImage({src:result.url,alt:file.name}).run();
    }catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}finally{uploadInFlight.current=false;setUploading(false);}
  }
  if(!template)return <div className="space-y-3 p-6"><p role={error?"alert":"status"}>{error||"Loading letter…"}</p>{error?<BuilderButton onClick={()=>setLoadAttempt(value=>value+1)}>Retry loading letter</BuilderButton>:null}</div>;
  const layout=(template.printLayoutJson&&typeof template.printLayoutJson==="object"?template.printLayoutJson:{}) as Record<string,unknown>;
  const page=(layout.letterPdfLayout||{}) as {pageSize?:string;margins?:Record<string,number>};
  const margins={top:.75,right:.75,bottom:.75,left:.75,...page.margins};
  function updateLayout(next:Record<string,unknown>){edits.current++;setTemplate(current=>current?{...current,printLayoutJson:{...layout,letterPdfLayout:{...page,...next}}}:current);setDirty(true);}
  const stale=dirty||!proofIdentity||proofIdentity.revision!==template.revision||proofIdentity.recipient!==recipient;
  return <main className="lb-workspace">
    <input type="file" ref={imageInput} accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.target.value="";}}/>
    <header className="lb-command"><Link className="lb-back" href={returnHref} aria-label="Back to campaign or letter templates"><ArrowLeft size={18} aria-hidden="true"/></Link><div className="lb-title"><span>LETTER STUDIO</span><input aria-label="Letter name" title="Rename this letter" value={template.name} onChange={e=>{edits.current++;setTemplate({...template,name:e.target.value});setDirty(true);}}/></div><BuilderStatus state={dirty?"warning":template.id?"saved":"draft"}>{busy?"Working…":dirty?"Unsaved":template.id?"Saved":"New draft"} · r{template.revision}</BuilderStatus><div className="lb-actions"><BuilderButton disabled={busy||uploading||!accepted} onClick={()=>void proof()}><Eye size={16} aria-hidden="true"/>Preview</BuilderButton><BuilderButton primary disabled={busy||uploading||!accepted} onClick={()=>void save()}><Save size={16} aria-hidden="true"/>Save letter</BuilderButton></div></header>
    {!accepted&&<div className="lb-notice">Review this legacy letter before saving its structured conversion. The saved original is retained until you save.<BuilderButton onClick={()=>setAccepted(true)}>Review conversion</BuilderButton></div>}
    {error&&<p role="alert" className="lb-error">{error}</p>}
    {uploading&&<p role="status" className="lb-notice">Uploading image… Wait for it to appear before saving or rendering a proof.</p>}
    <LetterFormattingToolbar editor={editor}/>
    <div className="lb-mobile-tabs" role="group" aria-label="Builder panels">{[{value:"write",icon:FileText},{value:"blocks",icon:Blocks},{value:"settings",icon:Settings2},{value:"proof",icon:Eye}].map(({value,icon:Icon})=><BuilderButton key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}><Icon size={15} aria-hidden="true"/>{value}</BuilderButton>)}</div>
    <div className="lb-studio">
      <aside className={`lb-left ${tab==="blocks"?"lb-mobile-visible":""}`}><BlockLibrary disabled={!editor} onInsert={insert}/><MergeFieldLibrary sections={sections} onInsert={token=>editor?.chain().focus().insertContent({type:"mergeField",attrs:{token:token.replace(/[{}]/g,"").trim()}}).run()}/></aside>
      <section className={`lb-canvas-column ${tab==="write"?"lb-mobile-visible":""}`}><div className="lb-canvas-caption"><span><FileText size={14}/>Document canvas</span><span>Continuous writing · PDF proof confirms page breaks</span></div><div className="lb-paper" style={{paddingTop:`${margins.top}in`,paddingBottom:`${margins.bottom}in`,paddingLeft:`${margins.left}in`,paddingRight:`${margins.right}in`}} onDragOver={event=>{if(event.dataTransfer.types.includes("application/oyama-letter-block"))event.preventDefault();}} onDrop={event=>{const block=event.dataTransfer.getData("application/oyama-letter-block");if(block){event.preventDefault();const position=editor?.view.posAtCoords({left:event.clientX,top:event.clientY});if(position)editor?.commands.setTextSelection(position.pos);insert(block);}}}><LetterEditor key={templateId || "new-letter"} initialContent={template.documentJson||template.printBody} onReady={ready} onChange={(html,json)=>{edits.current++;setBody({html,json});setDirty(true);}}/></div><div className="lb-canvas-footer"><span>{page.pageSize||"Letter (8.5 x 11 in)"}</span><span>{job?.pageCount?`${job.pageCount} proof pages${stale ? " · out of date" : ""}`:"Render proof to check pages"}</span></div></section>
    <section ref={proofSection} className={`lb-proof-section ${tab==="proof"?"lb-mobile-visible":""}`} hidden={!url&&!busy&&tab!=="proof"}><LetterProofViewer url={url} stale={!!url&&stale} busy={busy} label={url ? `Revision ${proofIdentity?.revision ?? "—"} · ${contacts.find(contact=>contact.id===proofIdentity?.recipient)?.firstName || "Sample"} ${contacts.find(contact=>contact.id===proofIdentity?.recipient)?.lastName || "proof"}` : "No PDF rendered"}/></section>
      <aside className={`lb-inspector ${tab==="settings"?"lb-mobile-visible":""}`}><div className="lb-inspector-tabs">{["document","review"].map(value=><button type="button" key={value} aria-pressed={inspector===value} onClick={()=>setInspector(value)}>{value==="document"?<Settings2 size={15}/>:<Eye size={15}/>} {value}</button>)}</div>
      {inspector==="document"?<><LetterDocumentSettings pageSize={page.pageSize} margins={margins} onChange={updateLayout}/><BuilderCard title="Letterhead & signature"><p className="lb-help">Production letterhead, footer, and signer follow your organization's branding defaults.</p><Link className="lb-text-link" href="/oyama-create/library/brand/letterhead">Manage letterhead and signature →</Link></BuilderCard></>:<BuilderCard title="Review checklist"><ReviewChecklist items={[{label:"Document title is set",ok:!!template.name.trim()},{label:"Latest changes saved",ok:!dirty&&!!template.id},{label:"Real recipient selected",ok:!!recipient},{label:"Current PDF proof ready",ok:!!url&&!stale}]}/><p className="lb-help">Review every printed page before generating or approving a batch.</p><Link className="lb-text-link" href="/oyama-letters/generate">Open letter generation →</Link></BuilderCard>}
      <BuilderCard title="Recipient preview">{contactError?<p role="alert" className="lb-help">{contactError} <BuilderButton onClick={()=>setContactAttempt(value=>value+1)}>Retry recipients</BuilderButton></p>:null}<label className="lb-field">CRM recipient<select aria-label="Proof recipient" value={recipient} onChange={e=>{setRecipient(e.target.value);serial.current++;proofAbort.current?.abort();setJob(null);setBusy(false);}}><option value="">Sample proof</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></label><p className="lb-help">Select a real contact to verify personalized text and pagination.</p><p className="lb-help">Use Preview in the command bar to render the selected recipient.</p></BuilderCard></aside>
    </div>

  </main>;
}
