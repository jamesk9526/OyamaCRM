"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useCreateData } from "./use-create-data";
import { Heading, Empty } from "./ui";
import { message } from "./types";
import ImportSourceReview,{type ImportedSource} from "./ImportSourceReview";
export default function ImportWorkspace({history=false}:{history?:boolean}){
  const {user}=useAuth(),router=useRouter(),admin=user?.role==="admin";
  const progress=useCreateData<{run:{status:string;scanned:number;lastError:string|null}|null;inventory:{total:number;statuses:Record<string,number>}}>(admin?"/api/oyama-create/imports":null);
  const reloadProgress=progress.reload;
  const [items,setItems]=useState<ImportedSource[]>([]),[query,setQuery]=useState(""),[type,setType]=useState(""),[status,setStatus]=useState(history?"HISTORICAL":""),[cursor,setCursor]=useState<string|null>(null),[total,setTotal]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState(""),[busy,setBusy]=useState("");
  const load=useCallback(async(after="")=>{
    setLoading(true);setError("");try{
      const result=await apiFetch<{items:ImportedSource[];nextCursor:string|null;total:number}>(`/api/oyama-create/imports/sources?q=${encodeURIComponent(query)}&type=${type}&status=${status}&after=${encodeURIComponent(after)}`);
      setItems(previous=>after?[...previous,...result.items.filter(item=>!previous.some(existing=>existing.id===item.id))]:result.items);setCursor(result.nextCursor);setTotal(result.total);
    }catch(value){setError(message(value));}finally{setLoading(false);}
  },[query,type,status]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),200);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{if(!admin||progress.data?.run?.status!=="RUNNING")return;const timer=setInterval(()=>{void reloadProgress();if(!items.length)void load();},5000);return()=>clearInterval(timer);},[admin,progress.data?.run?.status,reloadProgress,items.length,load]);
  async function control(action:string){setBusy(action);try{await apiFetch("/api/oyama-create/imports/control",{method:"POST",body:JSON.stringify({action})});await progress.reload();await load();}catch(value){setError(message(value));}finally{setBusy("");}}
  async function createDraft(item:ImportedSource){
    setBusy(item.id);setError("");try{
      let campaignId=item.campaignId;
      if(!campaignId){const imported=await apiFetch<{campaignId:string}>(`/api/oyama-create/imports/sources/${item.id}/use`,{method:"POST",body:"{}"});campaignId=imported.campaignId;}
      if(!campaignId)throw new Error("Open the original authored template to reuse this historical execution.");
      const created=await apiFetch<{id:string}>(`/api/oyama-create/campaigns/${campaignId}/duplicate`,{method:"POST",body:JSON.stringify({name:`${item.name} — new draft`,isTemplate:false})});router.push(`/oyama-create/campaigns/${created.id}`);
    }catch(value){setError(message(value));}finally{setBusy("");}
  }
  return <><Heading title={history?"Communication history":"Content import & source library"} subtitle={history?"Original sent emails, generated letters and PDFs stay preserved. Reuse their authored content as a fresh draft.":"Existing CRM content is imported automatically. Review preserved layouts and later legacy edits here."} action={<Link className="oc-button" href="/oyama-create/library">Create library</Link>}/>
    {admin&&<section className="oc-card oc-import-progress"><h2>Automatic import</h2>{progress.error?<p role="alert" className="oc-error">{progress.error} Apply the automatic-import database migration if it has not been installed.</p>:<><p role="status">{progress.data?.run?.status||"Preparing inventory"} · {progress.data?.inventory.total??"…"} existing source records · {progress.data?.run?.scanned||0} source checks, including rescans</p><div className="oc-import-counts">{Object.entries(progress.data?.inventory.statuses||{}).map(([label,count])=><span key={label}><strong>{count}</strong> {label.replaceAll("_"," ").toLowerCase()}</span>)}</div>{progress.data?.run?.lastError&&<p role="alert" className="oc-error">{progress.data.run.lastError}</p>}<div className="oc-actions"><button type="button" className="oc-button" disabled={!!busy} onClick={()=>void control(progress.data?.run?.status==="PAUSED"?"RESUME":"PAUSE")}>{progress.data?.run?.status==="PAUSED"?"Resume import":"Pause import"}</button><button type="button" className="oc-button" disabled={!!busy} onClick={()=>void control("RESCAN")}>Scan all sources now</button><button type="button" className="oc-button" disabled={!!busy} onClick={()=>void control("RETRY")}>Retry failed items</button></div></>}</section>}
    <div className="oc-toolbar"><input type="search" aria-label="Search imported content" placeholder="Search all imported content…" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="Imported source type" value={type} onChange={event=>setType(event.target.value)}><option value="">All source types</option>{["EMAIL","LETTER","GENERATED_LETTER","HEADER","FOOTER","SIGNATURE","ASSET","BROWSER_SECTION","BROWSER_DRAFT","BROWSER_LETTER"].map(value=><option key={value}>{value}</option>)}</select><select aria-label="Import status" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option>{["CONVERTED","NEEDS_REVIEW","SOURCE_CHANGED","HISTORICAL","CATALOGED","FAILED"].map(value=><option key={value}>{value}</option>)}</select><button type="button" className="oc-button" disabled={loading} onClick={()=>void load()}>Refresh sources</button></div>
    {error&&<p role="alert" className="oc-error">{error}</p>}
    <section className="oc-card"><div className="oc-card-heading"><h2>{history?"Preserved history":"Imported content"}</h2><span className="oc-help">{total} matching records</span></div>{!items.length?<Empty title={loading?"Loading source content…":"No matching imported records"}>Automatic import fills this library as records are checked. Adjust the filters or refresh after the first scan.</Empty>:<div className="oc-table-scroll"><table className="oc-table"><thead><tr><th>Content</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.name}</strong>{item.error&&<small className="oc-error">{item.error}</small>}{item.missing&&<small>Original source removed; imported content retained.</small>}</td><td>{item.sourceType.replaceAll("_"," ")}</td><td>{item.status.replaceAll("_"," ")}</td><td><div className="oc-actions"><button type="button" className="oc-button small" onClick={()=>setSelected(item.id)}>{["NEEDS_REVIEW","SOURCE_CHANGED"].includes(item.status)?"Review original & conversion":"View original"}</button>{item.campaignId&&item.status!=="HISTORICAL"&&<Link className="oc-button small" href={`/oyama-create/campaigns/${item.campaignId}`}>Open in Create</Link>}{item.status==="HISTORICAL"&&["EMAIL","GENERATED_LETTER","LETTER"].includes(item.sourceType)&&<button type="button" className="oc-button small" disabled={!!busy} onClick={()=>void createDraft(item)}>Use as new draft</button>}{["HEADER","FOOTER","SIGNATURE","ASSET"].includes(item.sourceType)&&<Link className="oc-button small" href="/oyama-create/library/brand">Brand Hub</Link>}</div></td></tr>)}</tbody></table></div>}{cursor&&<div className="oc-card-body"><button type="button" className="oc-button" disabled={loading} onClick={()=>void load(cursor)}>Load more source records</button></div>}</section>
    {selected&&<ImportSourceReview id={selected} close={()=>setSelected("")} changed={async()=>{await load();await progress.reload();}}/>}
  </>;
}
