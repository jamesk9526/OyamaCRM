"use client";
import { useState } from "react";
import { useCreateData } from "./use-create-data";
import ImportSourceReview,{type ImportedSource} from "./ImportSourceReview";
export default function ContentImportNotice({contentId,onChanged}:{contentId:string;onChanged:()=>Promise<unknown>}){
  const resource=useCreateData<{items:ImportedSource[]}>(`/api/oyama-create/imports/sources?contentId=${contentId}`),[selected,setSelected]=useState("");
  const pending=resource.data?.items.filter(item=>["NEEDS_REVIEW","SOURCE_CHANGED","FAILED"].includes(item.status))||[];
  return <>{pending.map(item=><div className="oc-notice" key={item.id}>{item.status==="SOURCE_CHANGED"?"A legacy source changed separately.":"Imported content needs a comparison before release."} <button className="oc-button small" onClick={()=>setSelected(item.id)}>Review {item.name}</button></div>)}{selected&&<ImportSourceReview id={selected} close={()=>setSelected("")} changed={async()=>{await onChanged();await resource.reload();}}/>}</>;
}
