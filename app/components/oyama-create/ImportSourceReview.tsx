"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { sanitizeStudioHtml } from "@/server/src/oyama-create/studio/html";
import { useCreateData } from "./use-create-data";
import { Modal } from "./ui";
import { message, type Campaign } from "./types";
export type ImportedSource={id:string;sourceId:string;sourceType:string;name:string;status:string;fingerprint:string|null;campaignId:string|null;contentId:string|null;diagnostics:string[];error:string|null;missing:boolean};
type Revision={id:string;fingerprint:string;snapshotJson:{originalHtml?:string;record?:Record<string,unknown>};createdAt:string};
export default function ImportSourceReview({id,close,changed}:{id:string;close:()=>void;changed:()=>Promise<unknown>}){
  const resource=useCreateData<{source:ImportedSource;revisions:Revision[];currentRevision?:Revision;nextCursor?:string|null;deliveryRecords?:Array<{id:string;email:string;status:string;error?:string}>;nextDeliveryCursor?:string|null}>(`/api/oyama-create/imports/sources/${id}`);
  const [campaign,setCampaign]=useState<Campaign|null>(null),[converted,setConverted]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const source=resource.data?.source,original=resource.data?.currentRevision||resource.data?.revisions.find(item=>item.fingerprint===source?.fingerprint)||resource.data?.revisions[0],record=original?.snapshotJson.record;
  useEffect(()=>{
    if(!source?.campaignId||!source.contentId)return;let active=true;
    void apiFetch<Campaign>(`/api/oyama-create/campaigns/${source.campaignId}`).then(async value=>{
      if(active)setCampaign(value);const content=value.contents?.find(item=>item.id===source.contentId);if(!content?.designJson)return;
      const channel=["LETTER","BROWSER_LETTER"].includes(source.sourceType)?"LETTER":"EMAIL";
      const result=await apiFetch<{html:string}>(`/api/oyama-create/contents/${content.id}/studio/preview`,{method:"POST",body:JSON.stringify({channel,design:content.designJson})});if(active)setConverted(result.html);
    }).catch(value=>{if(active)setError(message(value));});return()=>{active=false;};
  },[source?.campaignId,source?.contentId,source?.sourceType]);
  async function loadDeliveries(){if(!resource.data?.nextDeliveryCursor)return;setBusy(true);setError("");try{const next=await apiFetch<NonNullable<typeof resource.data>>(`/api/oyama-create/imports/sources/${id}?deliveryAfter=${encodeURIComponent(resource.data.nextDeliveryCursor)}`);resource.setData({...resource.data,deliveryRecords:[...(resource.data.deliveryRecords||[]),...(next.deliveryRecords||[])],nextDeliveryCursor:next.nextDeliveryCursor});}catch(value){setError(message(value));}finally{setBusy(false);}}
  async function loadOlder(){if(!resource.data?.nextCursor)return;setBusy(true);setError("");try{const next=await apiFetch<NonNullable<typeof resource.data>>(`/api/oyama-create/imports/sources/${id}?after=${encodeURIComponent(resource.data.nextCursor)}`);resource.setData({...next,revisions:[...resource.data.revisions,...next.revisions]});}catch(value){setError(message(value));}finally{setBusy(false);}}
  async function review(choice?:"KEEP_CREATE"|"USE_SOURCE"){
    if(!source||!campaign)return;setBusy(true);setError("");try{
      await apiFetch(`/api/oyama-create/imports/sources/${id}/${choice?"reconcile":"review"}`,{method:"POST",body:JSON.stringify({confirm:true,choice,fingerprint:source.fingerprint,campaignRevision:campaign.revision,contentRevision:campaign.contents?.find(item=>item.id===source.contentId)?.revision})});
      await changed();close();
    }catch(value){setError(message(value));}finally{setBusy(false);}
  }
  const originalHtml=original?.snapshotJson.originalHtml||String(record?.bodyHtml||record?.printBody||record?.mergedPrintBody||"");
  return <Modal title={source?.name||"Imported source"} wide close={()=>{if(!busy)close();}}>
    {(error||resource.error)&&<p role="alert" className="oc-error">{error||resource.error}</p>}
    {!source?<p role="status">Loading preserved source…</p>:<><p className="oc-help">{source.sourceType.replaceAll("_"," ")} · {source.status.replaceAll("_"," ")}. Originals and delivery history remain unchanged.</p>{source.diagnostics?.map((item,index)=><p className="oc-notice" key={index}>{item}</p>)}
      {source.status==="HISTORICAL"&&<div className="oc-notice">Original status: {String(record?.status||"Recorded")}{record?.sentAt?` · Sent ${new Date(String(record.sentAt)).toLocaleString()}`:""}{record?.totalRecipients!==undefined?` · ${record.totalRecipients} recipients`:""}. Reusing history creates a separate draft with recipients and schedules cleared.</div>}
      {!!resource.data?.deliveryRecords?.length&&<details><summary>Original delivery records</summary><div className="oc-table-scroll"><table className="oc-table"><thead><tr><th>Recipient</th><th>Status</th></tr></thead><tbody>{resource.data.deliveryRecords.map(item=><tr key={item.id}><td>{item.email}</td><td>{item.status}{item.error&&<p className="oc-error">{item.error}</p>}</td></tr>)}</tbody></table></div>{resource.data.nextDeliveryCursor&&<button type="button" className="oc-button" disabled={busy} onClick={()=>void loadDeliveries()}>Load more delivery records</button>}</details>}
      <div className="oc-source-comparison"><section><h3>Preserved original</h3>{originalHtml?<iframe title="Imported original layout" sandbox="" srcDoc={sanitizeStudioHtml(originalHtml)}/>:<pre>{JSON.stringify(record,null,2)}</pre>}</section><section><h3>Current Create draft</h3>{converted?<iframe title="Converted Create layout" sandbox="" srcDoc={converted}/>:<p className="oc-help">Historical output or a catalog resource. Open its template to create an editable draft.</p>}</section></div>
      {source.status==="NEEDS_REVIEW"&&campaign&&<button type="button" className="oc-button primary" disabled={busy} onClick={()=>void review()}>I compared and accept this conversion</button>}
      {source.status==="SOURCE_CHANGED"&&campaign&&<div className="oc-actions"><button type="button" className="oc-button primary" disabled={busy} onClick={()=>void review("KEEP_CREATE")}>Keep Create; retain legacy change in history</button><button type="button" className="oc-button" disabled={busy} onClick={()=>{if(window.confirm("Replace this Create draft with the changed source? The current draft remains in revision history."))void review("USE_SOURCE");}}>Use changed source as this draft</button></div>}
      {record?.pdfUrl&&/^(https?:\/\/|\/(?!\/))/.test(String(record.pdfUrl))&&<a className="oc-button" href={String(record.pdfUrl)} target="_blank" rel="noreferrer">Open original PDF</a>}
      <details className="oc-disclosure"><summary>Source revision history</summary>{resource.data?.revisions.map(item=><div className="oc-list-item" key={item.id}><div><strong>{new Date(item.createdAt).toLocaleString()}</strong><p>{item.fingerprint.slice(0,16)}</p></div></div>)}{resource.data?.nextCursor&&<button type="button" className="oc-button" disabled={busy} onClick={()=>void loadOlder()}>Load older source revisions</button>}</details>
    </>}
  </Modal>;
}
