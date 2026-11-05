"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreate } from "./CreateShell";
import { Modal } from "./ui";
import { message } from "./types";
type Recoverable={id:string;name:string;kind:"SECTION"|"DRAFT";record:Record<string,unknown>};
export default function BrowserRecovery(){
  const {user}=useAuth(),{permissions}=useCreate();
  const [items,setItems]=useState<Recoverable[]>([]),[open,setOpen]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    if(!user||!permissions.includes("edit:communications")&&!permissions.includes("letters.create"))return;
    const found:Recoverable[]=[];
    try{const parsed=JSON.parse(localStorage.getItem("emailBuilder.reusableSections.v1")||"[]");if(permissions.includes("edit:communications")&&Array.isArray(parsed))for(const item of parsed)if(item?.block&&typeof item.name==="string")found.push({id:`section:${item.id}`,name:item.name,kind:"SECTION",record:{block:item.block}});}catch{/* keep invalid local storage intact */}
    try{const parsed=JSON.parse(localStorage.getItem("oyamaLetters.templateRecovery.v1")||"{}");if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))for(const [id,item]of Object.entries(parsed)){const snapshot=item as {draft?:Record<string,unknown>;templateId?:string};if(snapshot.draft&&permissions.includes("letters.create")&&permissions.includes("letters.edit"))found.push({id:`draft:${id}`,name:String(snapshot.draft.name||"Recovered letter draft"),kind:"DRAFT",record:{...snapshot.draft,_legacyTemplateId:snapshot.templateId||id}});}}catch{/* keep invalid recovery data intact */}
    setItems(found);
  },[user,permissions]);
  async function recover(item:Recoverable){if(!user)return;setBusy(item.id);setError("");try{await apiFetch("/api/oyama-create/imports/recover",{method:"POST",body:JSON.stringify({organizationId:user.organizationId,confirm:confirmed,kind:item.kind,name:item.name,record:item.record})});setItems(previous=>previous.filter(value=>value.id!==item.id));}catch(value){setError(message(value));}finally{setBusy("");}}
  if(!items.length)return null;
  return <><div className="oc-notice">This browser has {items.length} recoverable draft{items.length===1?"":"s"} or saved section{items.length===1?"":"s"}. <button type="button" className="oc-button small" onClick={()=>setOpen(true)}>Review browser recovery</button></div>{open&&<Modal title="Recover content from this browser" close={()=>setOpen(false)}><p>These donor communication items were stored only in this browser. Clinical content is excluded. Confirm that they belong to your current organization before importing. Local originals will remain untouched.</p><label className="oc-check"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Recover privately into organization {user?.organizationId}</label>{error&&<p className="oc-error" role="alert">{error}</p>}{items.map(item=><div className="oc-list-item" key={item.id}><div><strong>{item.name}</strong><p>{item.kind.toLowerCase()}</p></div><button type="button" className="oc-button" disabled={!confirmed||!!busy} onClick={()=>void recover(item)}>{busy===item.id?"Recovering…":"Recover into Create"}</button></div>)}</Modal>}</>;
}
