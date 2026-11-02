"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import LetterEditor from "./LetterEditor";
import LetterFormattingToolbar from "./LetterFormattingToolbar";
import LetterProofViewer from "./LetterProofViewer";
import { BuilderButton, BuilderCard, BuilderStatus, BlockLibrary, MergeFieldLibrary, ReviewChecklist, insertLetterBlock } from "./LetterBuilderKit";
import Link from "next/link";
import { ArrowLeft, Eye, Save, Settings2, FileText } from "lucide-react";
import "./letter-production.css";

type Template = { id: string; name: string; category: string; printSubject: string; printBody: string; documentJson?: JSONContent; documentSchemaVersion: number; revision: number; printLayoutJson: unknown };
type Job = { id: string; status: string; error?: string; revision: number; recipient?: { name: string }; pageCount?: number };
export default function ProductionBuilder({ templateId }: { templateId?: string }) {
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
  const [job,setJob] = useState<Job | null>(null); const [url,setUrl] = useState<string | null>(null);
  const [tab,setTab] = useState("write"); const serial=useRef(0); const edits=useRef(0);
  useEffect(() => { let active=true; const requests = serial; void Promise.all([
    templateId ? apiFetch<Template>(`/api/letters/templates/${templateId}`) : Promise.resolve({id:"",name:"Untitled letter",category:"GENERAL",printSubject:"",printBody:"<p></p>",documentSchemaVersion:2,revision:0,printLayoutJson:{}} as Template),
    apiFetch<Array<{id:string;firstName:string;lastName:string}>>("/api/constituents?limit=all")
  ]).then(([value,people]) => {if(active){setTemplate(value);setContacts(people);setAccepted(value.documentSchemaVersion===2);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;requests.current++;};},[templateId]);
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
    try {const saved=await apiFetch<Template>(`/api/letters/production/templates${template.id?`/${template.id}`:""}`,{method:template.id?"PATCH":"POST",body:JSON.stringify({...template,printBody:body.html,documentJson:body.json})});setTemplate(current=>edits.current===savingEdit?saved:{...current!,id:saved.id,revision:saved.revision});setDirty(edits.current!==savingEdit);return edits.current===savingEdit?saved:undefined;}
    catch(e){setError(e instanceof Error?e.message:"Save failed. Your draft remains in the editor.");}finally{setBusy(false);}
  }
  async function proof(){
    const request=++serial.current;
    const saved=dirty||!template?.id?await save():template;if(!saved||request!==serial.current)return;
    setBusy(true);setError("");
    try{let next=await apiFetch<Job>("/api/letters/production/jobs",{method:"POST",body:JSON.stringify({templateId:saved.id,revision:saved.revision,constituentId:recipient})});
      const deadline=Date.now()+90000;
      while(["PENDING","RENDERING"].includes(next.status)&&Date.now()<deadline){if(request!==serial.current)return;setJob(next);await new Promise(resolve=>setTimeout(resolve,1000));next=await apiFetch<Job>(`/api/letters/production/jobs/${next.id}`);}
      if(request!==serial.current)return;setJob(next);
      if(next.status!=="READY")throw new Error(next.error||"The proof is still queued. Check that the production worker is running, then retry.");
      const response=await apiFetchResponse(`/api/letters/production/artifacts/${next.id}/pdf`);if(!response.ok)throw new Error("The PDF could not be loaded.");
      const blob=await response.blob();if(request===serial.current)setUrl(URL.createObjectURL(blob));
    }catch(e){if(request===serial.current)setError(e instanceof Error?e.message:"Proof failed.");}finally{if(request===serial.current)setBusy(false);}
  }
  function insert(id:string){
    if(!editor)return;
    if(id==="image"){imageInput.current?.click();return;}
    if(id==="signature"){setInspector("document");return;}
    insertLetterBlock(editor,id);
  }
  async function upload(file:File){
    if(!editor)return;
    try{
      if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5000000)throw new Error("Choose a PNG, JPEG, or WebP image up to 5 MB.");
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const result=await apiFetch<{url:string}>("/api/letters/media",{method:"POST",body:JSON.stringify({fileName:file.name,mimeType:file.type,dataBase64:data,purpose:"editor"})});
      editor.chain().focus().setImage({src:result.url,alt:file.name}).run();
    }catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}
  }
  if(!template)return <div className="p-6" role="status">{error||"Loading letter…"}</div>;
  const layout=(template.printLayoutJson&&typeof template.printLayoutJson==="object"?template.printLayoutJson:{}) as Record<string,unknown>;
  const page=(layout.letterPdfLayout||{}) as {pageSize?:string;margins?:Record<string,number>};
  const margins={top:.75,right:.75,bottom:.75,left:.75,...page.margins};
  function updateLayout(next:Record<string,unknown>){edits.current++;setTemplate(current=>current?{...current,printLayoutJson:{...layout,letterPdfLayout:{...page,...next}}}:current);setDirty(true);}
  const stale=dirty||!job||job.revision!==template.revision;
  return <main className="lb-workspace">
    <input type="file" ref={imageInput} accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.target.value="";}}/>
    <header className="lb-command"><Link href="/oyama-letters/templates" aria-label="Back to letter templates"><ArrowLeft size={20}/></Link><div className="lb-title"><span>LETTER CREATOR</span><input aria-label="Letter name" value={template.name} onChange={e=>{edits.current++;setTemplate({...template,name:e.target.value});setDirty(true);}}/></div><BuilderStatus state={dirty?"warning":"saved"}>{busy?"Working…":dirty?"Unsaved":"Saved"} · r{template.revision}</BuilderStatus><div className="lb-actions"><BuilderButton disabled={busy||!accepted} onClick={()=>void proof()}><Eye size={16}/>Preview</BuilderButton><BuilderButton primary disabled={busy||!accepted} onClick={()=>void save()}><Save size={16}/>Save letter</BuilderButton></div></header>
    {!accepted&&<div className="lb-notice">Review this legacy letter before saving its structured conversion. The saved original is retained until you save.<BuilderButton onClick={()=>setAccepted(true)}>Review conversion</BuilderButton></div>}
    {error&&<p role="alert" className="lb-error">{error}</p>}
    <LetterFormattingToolbar editor={editor} onImage={()=>imageInput.current?.click()}/>
    <div className="lb-mobile-tabs">{["write","blocks","settings","proof"].map(value=><BuilderButton key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{value}</BuilderButton>)}</div>
    <div className="lb-studio">
      <aside className={`lb-left ${tab==="blocks"?"lb-mobile-visible":""}`}><BlockLibrary disabled={!editor} onInsert={insert}/><MergeFieldLibrary sections={sections} onInsert={token=>editor?.chain().focus().insertContent({type:"mergeField",attrs:{token:token.replace(/[{}]/g,"").trim()}}).run()}/></aside>
      <section className={`lb-canvas-column ${tab==="write"?"lb-mobile-visible":""}`}><div className="lb-canvas-caption"><span><FileText size={14}/>Document canvas</span><span>Continuous writing · PDF proof confirms page breaks</span></div><div className="lb-paper" style={{paddingTop:`${margins.top}in`,paddingBottom:`${margins.bottom}in`,paddingLeft:`${margins.left}in`,paddingRight:`${margins.right}in`}} onDragOver={event=>{if(event.dataTransfer.types.includes("application/oyama-letter-block"))event.preventDefault();}} onDrop={event=>{const block=event.dataTransfer.getData("application/oyama-letter-block");if(block){event.preventDefault();const position=editor?.view.posAtCoords({left:event.clientX,top:event.clientY});if(position)editor?.commands.setTextSelection(position.pos);insert(block);}}}><LetterEditor initialContent={template.documentJson||template.printBody} onReady={ready} onChange={(html,json)=>{edits.current++;setBody({html,json});setDirty(true);}}/></div><div className="lb-canvas-footer"><span>{page.pageSize||"Letter (8.5 x 11 in)"}</span><span>{job?.pageCount?`${job.pageCount} proof pages`:"Render proof to check pages"}</span></div></section>
      <aside className={`lb-inspector ${tab==="settings"?"lb-mobile-visible":""}`}><div className="lb-inspector-tabs">{["document","review"].map(value=><button type="button" key={value} aria-pressed={inspector===value} onClick={()=>setInspector(value)}>{value==="document"?<Settings2 size={15}/>:<Eye size={15}/>} {value}</button>)}</div>
      {inspector==="document"?<><BuilderCard title="Document settings"><label className="lb-field">Paper size<select aria-label="Paper size" value={page.pageSize||"Letter (8.5 x 11 in)"} onChange={e=>updateLayout({pageSize:e.target.value})}><option>Letter (8.5 x 11 in)</option><option>A4 (8.27 x 11.69 in)</option><option>Legal (8.5 x 14 in)</option></select></label><p className="lb-label">Margins (inches)</p><div className="lb-margin-grid">{Object.entries(margins).map(([key,value])=><label className="lb-field" key={key}>{key}<input type="number" min="0.125" max="1.5" step="0.125" value={value} onChange={e=>{const number=e.target.valueAsNumber;if(Number.isFinite(number))updateLayout({margins:{...margins,[key]:Math.min(1.5,Math.max(.125,number))}});}}/></label>)}</div></BuilderCard><BuilderCard title="Letterhead & signature"><p className="lb-help">Production letterhead, footer, and signer follow your organization's branding defaults.</p><Link className="lb-text-link" href="/settings/branding#letter-output-defaults">Manage letterhead and signature →</Link></BuilderCard></>:<BuilderCard title="Review checklist"><ReviewChecklist items={[{label:"Document title is set",ok:!!template.name.trim()},{label:"Latest changes saved",ok:!dirty&&!!template.id},{label:"Real recipient selected",ok:!!recipient},{label:"Current PDF proof ready",ok:!!url&&!stale}]}/><p className="lb-help">Review every printed page before generating or approving a batch.</p><Link className="lb-text-link" href="/oyama-letters/generate">Open letter generation →</Link></BuilderCard>}
      <BuilderCard title="Recipient preview"><label className="lb-field">CRM recipient<select aria-label="Proof recipient" value={recipient} onChange={e=>{setRecipient(e.target.value);serial.current++;setJob(null);setBusy(false);}}><option value="">Sample proof</option>{contacts.map(contact=><option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select></label><p className="lb-help">Select a real contact to verify personalized text and pagination.</p><BuilderButton primary disabled={busy||!accepted} onClick={()=>{void proof();setTab("proof");}}>Render print proof</BuilderButton></BuilderCard></aside>
    </div>
    <section ref={proofSection} className={`lb-proof-section ${tab==="proof"?"lb-mobile-visible":""}`} hidden={!url&&!busy&&tab!=="proof"}><LetterProofViewer url={url} stale={!!url&&stale} busy={busy} label={job?.recipient?.name||"Selected recipient"}/></section>
  </main>;
}
