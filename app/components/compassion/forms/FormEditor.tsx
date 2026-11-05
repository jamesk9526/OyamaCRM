"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import { FORM_TEMPLATES, answerIssues, validateAnswers, type Answers } from "@/server/src/compassion/form-templates";
import { useCareAccess } from "../CompassionShell";
import { CareError, careWrite, downloadCareFile, useCareData } from "../care-ui";
import PaperForm from "./PaperForm";
import { formUrl } from "./ClientForms";
import "./paper-forms.css";
interface FormRecord { id: string; kind: string; clientId: string; caseId?: string; visitId?: string; status: string; version: number; updatedAt: string; authorId: string; answers?: Answers; content?: { answers: Answers; amendmentReason?: string; _review?: { reason: string } } }
interface Attachment { id: string; name: string }
export default function FormEditor({ clientId, recordId }: { clientId: string; recordId: string }) {
  const params = useSearchParams(); const kind = params.get("kind") || "CASE_INTAKE"; const template = FORM_TEMPLATES[kind];
  const clinical = template?.capability === "clinical"; const access = useCareAccess(); const { user } = useAuth(); const router = useRouter();
  const [row,setRow] = useState<FormRecord | null>(null); const [answers,setAnswers] = useState<Answers>({}); const [loading,setLoading] = useState(true); const [error,setError] = useState(""); const [notice,setNotice] = useState(""); const [busy,setBusy] = useState(false); const [dirty,setDirty] = useState(false); const [blank,setBlank] = useState(false); const [attest,setAttest] = useState(false); const [reason,setReason] = useState(""); const [attachments,setAttachments] = useState<Attachment[]>([]); const [revisions,setRevisions] = useState<Array<{ version: number; answers: Answers }>>([]);
  const [attempt,setAttempt] = useState(0);
  const client = useCareData<{ firstName: string; lastName: string; dateOfBirth?: string; email?: string; phone?: string; addressLine1?: string; city?: string; state?: string; zip?: string }>(`/api/compassion/clients/${encodeURIComponent(clientId)}`);
  const base = clinical ? "/charts" : "/case-forms";
  const editable = !row || (!clinical || (row.status === "DRAFT" && row.authorId === user?.id));
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    if (recordId === "new") { setRow(null); setAnswers({}); setLoading(false); return; }
    apiFetch<FormRecord>(`/api/compassion${base}/${encodeURIComponent(recordId)}`).then(value => {
      if (!active) return;
      if (value.clientId !== clientId || value.kind !== kind) throw new Error("This form does not belong to the selected client and template.");
      setRow(value); setAnswers(value.answers ?? value.content?.answers ?? {}); setDirty(false);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [recordId,base,clientId,kind,attempt]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const click = (e: MouseEvent) => { if (e.target instanceof Element && e.target.closest("a[href]") && !window.confirm("Discard unsaved form changes?")) { e.preventDefault(); e.stopPropagation(); } };
    const navigation = (e: Event) => { const event = e as Event & { navigationType?: string; cancelable: boolean }; if (event.navigationType === "traverse" && event.cancelable && !window.confirm("Discard unsaved form changes?")) event.preventDefault(); };
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    window.addEventListener("beforeunload",unload); document.addEventListener("click",click,true); nav?.addEventListener("navigate",navigation);
    return () => { window.removeEventListener("beforeunload",unload); document.removeEventListener("click",click,true); nav?.removeEventListener("navigate",navigation); };
  }, [dirty]);
  const loadAttachments = useCallback(async (id: string) => { const path = clinical ? `/documents?clientId=${encodeURIComponent(clientId)}` : `/case-forms/${id}/documents`; const files = await apiFetch<Array<Attachment & { chartId?: string }>>(`/api/compassion${path}`); setAttachments(clinical ? files.filter(f => f.chartId === id) : files); }, [clinical,clientId]);
  useEffect(() => { if (row?.id) void loadAttachments(row.id).catch(e => setError(e.message)); }, [row?.id,loadAttachments]);
  async function run(work: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await work(); } catch(e) { setError(e instanceof Error ? e.message : "Unable to save. Your edits are retained."); } finally { setBusy(false); } }
  async function save(close = false, complete = false) {
    await run(async () => {
      const issues = validateAnswers(kind,answers); if (issues.length) throw new Error(issues.join(" "));
      const content = { answers, ...(row?.content?.amendmentReason ? { amendmentReason: row.content.amendmentReason } : {}) };
      const value = row ? await careWrite<{ id: string }>(`${base}/${row.id}`, clinical ? { content, expectedUpdatedAt: row.updatedAt } : { answers, expectedVersion: row.version, status: complete ? "COMPLETE" : "DRAFT" },"PATCH") : await careWrite<{ id: string }>(base,{ clientId, kind, answers, content, caseId: params.get("caseId") || undefined, visitId: params.get("visitId") || undefined });
      setDirty(false);
      if (close) { router.push(`/compassion/clients/${clientId}?tab=forms`); return; }
      if (!row) { router.replace(formUrl(clientId,kind,value.id)); return; }
      const updated = await apiFetch<FormRecord>(`/api/compassion${base}/${value.id}`); setRow(updated); setNotice(complete ? "Form marked complete; earlier revisions are preserved." : "Draft saved securely.");
    });
  }
  async function upload(file: File) {
    await run(async () => {
      if (!row) throw new Error("Save the draft before attaching its signed original.");
      if (file.size > 10000000) throw new Error("Choose a file up to 10 MB.");
      if (!clinical && !window.confirm("Confirm this file contains casework intake only. Combined health documents must be attached to a clinical form.")) return;
      const encoded = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read this file."));reader.readAsDataURL(file); });
      await careWrite(clinical ? "/documents" : `/case-forms/${row.id}/documents`, { clientId, chartId: clinical ? row.id : undefined, name:file.name,mimeType:file.type,base64:encoded,historical:true,confirmCaseworkOnly:!clinical });
      await loadAttachments(row.id); setNotice("Signed paper original attached securely.");
    });
  }
  if (!template || !access?.capabilities.includes(template.capability)) return <CareError error="Your role cannot open this form." />;
  const warnings = answerIssues(kind,answers);
  const close = () => { if (!dirty || window.confirm("Discard unsaved form changes?")) router.push(`/compassion/clients/${clientId}?tab=forms`); };
  return <div className="care-form-editor">
    <div className="care-form-editor-header care-no-print"><div><Link href={`/compassion/clients/${clientId}?tab=forms`}>← Client file</Link><h1>{template.title}</h1><p>{client.data ? `${client.data.firstName} ${client.data.lastName}` : "Client file"} · {row ? `${row.status.toLowerCase()} · revision ${row.version}` : "New paper transcription"}</p></div><button className="care-button secondary" onClick={close}>Close</button></div>
    <CareError error={error || client.error} />{notice && <p className="care-notice care-no-print" role="status">{notice}</p>}
    {loading ? <p role="status">Opening form…</p> : recordId !== "new" && !row ? <button className="care-button secondary" onClick={() => setAttempt(x=>x+1)}>Try again</button> : <>
    <div className="care-form-tools care-no-print"><nav aria-label="Form pages">{template.pages.map((_,i)=><a key={i} href={`#paper-page-${i+1}`}>Page {i+1}</a>)}</nav><span>Template v{template.version} · {dirty ? "Unsaved changes" : "Paper transcription"}</span>{!row && client.data && <button className="care-button secondary" onClick={() => { const p=client.data!; setAnswers(a=>({...a,firstName:p.firstName,lastName:p.lastName,...(clinical?{name:`${p.firstName} ${p.lastName}`} : {email:p.email || "",phone:p.phone || "",mailingAddress:p.addressLine1 || "",city:p.city || "",state:p.state || "",zip:p.zip || ""}),dateOfBirth:p.dateOfBirth?.slice(0,10) || ""})); if(clinical) setAnswers(a=>Object.fromEntries(Object.entries(a).filter(([k])=>!["firstName","lastName"].includes(k))));setDirty(true); }}>Prefill client details for review</button>}</div>
    {warnings.length > 0 && <div className="care-notice care-no-print" role="alert">{warnings.join(" ")} Drafts retain the original selections.</div>}
    {row?.content?._review && <div className="care-notice care-no-print">Physician correction request: {row.content._review.reason}</div>}
    <PaperForm kind={kind} answers={answers} blank={blank} readOnly={!editable || busy} onChange={(key,value)=>{setAnswers(a=>({...a,[key]:value}));setDirty(true);}} />
    <div className="care-form-support care-no-print"><section><h2>Signed paper originals</h2><p>Signature fields transcribe the paper; typing a name does not execute a client signature. Attach the signed source. Health information remains clinical.</p><input type="file" aria-label="Attach signed paper original" accept="application/pdf,image/png,image/jpeg" disabled={busy || !row || !editable} onChange={e=>{ const file=e.target.files?.[0];if(file)void upload(file);e.target.value=""; }} />{attachments.map(file=><button className="care-button secondary" key={file.id} disabled={busy} onClick={()=>void run(async()=>{downloadCareFile(await apiFetch(`/api/compassion/${clinical?"documents":"case-form-documents"}/${file.id}/download`));})}>{file.name}</button>)}</section>
    {row && !clinical && <section><h2>Revision history</h2><button className="care-button secondary" disabled={busy} onClick={()=>void run(async()=>setRevisions(await apiFetch(`/api/compassion/case-forms/${row.id}/revisions`)))}>View earlier revisions</button>{revisions.map(r=><details key={r.version}><summary>Revision {r.version}</summary><dl>{Object.entries(r.answers).map(([k,v])=><div key={k}><dt>{FORM_TEMPLATES[kind].pages.flat().flatMap(s=>s.fields).find(f=>f.key===k)?.label || k}</dt><dd>{Array.isArray(v)?v.join(", "):v}</dd></div>)}</dl></details>)}
    {kind === "CASE_INTAKE" && <button className="care-button secondary" disabled={busy || dirty} onClick={()=>void run(async()=>{if(!window.confirm("Apply this saved intake’s identity and contact preferences to the client profile? Blank identity fields retain existing values; unconfirmed contact channels become off."))return;await careWrite(`/case-forms/${row.id}/apply-profile`,{approve:true,expectedVersion:row.version});await client.reload();setNotice("Reviewed identity and contact preferences applied.");})}>Review and apply to client profile</button>}</section>}
    {clinical && row && <section><h2>Clinical review</h2>{row.status==="DRAFT" && editable && <button className="care-button" disabled={busy || dirty} onClick={()=>void run(async()=>{await careWrite(`/charts/${row.id}/submit`,{expectedUpdatedAt:row.updatedAt});setAttempt(x=>x+1);setNotice("Submitted and locked for physician review.");})}>Submit for physician review</button>}
    {row.status==="REVIEW" && access.capabilities.includes("sign") && <><label><input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)} /> I reviewed this chart and its attachments.</label><button className="care-button" disabled={busy || !attest} onClick={()=>void run(async()=>{await careWrite(`/charts/${row.id}/sign`,{expectedUpdatedAt:row.updatedAt,attest:true});setAttempt(x=>x+1);})}>Sign chart</button><label>Correction requested<input value={reason} onChange={e=>setReason(e.target.value)} /></label><button className="care-button secondary" disabled={busy || !reason.trim()} onClick={()=>void run(async()=>{await careWrite(`/charts/${row.id}/return`,{reason,expectedUpdatedAt:row.updatedAt});setAttempt(x=>x+1);})}>Return to author</button></>}
    {row.status==="SIGNED" && <><Link className="care-button secondary" href={`/compassion/care/reports/${row.id}`}>Signed report</Link><label>Reason for amendment<input value={reason} onChange={e=>setReason(e.target.value)} /></label><button className="care-button secondary" disabled={busy || !reason.trim()} onClick={()=>void run(async()=>{const result=await careWrite<{id:string}>("/charts",{clientId,kind,caseId:row.caseId,visitId:row.visitId,previousId:row.id,content:{answers,amendmentReason:reason}});router.push(formUrl(clientId,kind,result.id));})}>Create amendment draft</button></>}</section>}
    </div><footer className="care-form-footer care-no-print"><span role="status">{busy?"Saving…":dirty?"Unsaved changes":"Saved on server after Save"}</span><button className="care-button secondary" disabled={busy} onClick={()=>{setBlank(false);setTimeout(()=>window.print(),0);}}>Print completed form</button><button className="care-button secondary" disabled={busy} onClick={()=>{setBlank(true);setTimeout(()=>{window.print();setBlank(false);},0);}}>Print blank</button>{editable && <><button className="care-button secondary" disabled={busy} onClick={()=>void save()}>Save draft</button>{row&&!clinical&&<button className="care-button secondary" disabled={busy || warnings.length>0} onClick={()=>void save(false,true)}>Mark complete</button>}<button className="care-button" disabled={busy} onClick={()=>void save(true)}>Save and close</button></>}</footer>
    </>}
  </div>;
}
