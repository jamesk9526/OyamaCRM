"use client";
import {useEffect,useState} from "react";
import {apiFetch} from "@/app/lib/auth-client";
import {useCreateData} from "../use-create-data";
import {Modal} from "../ui";
import {message} from "../types";
import WorkspaceRollout from "../v5/WorkspaceRollout";
export default function StudioRollout(){
 const config=useCreateData<{studioEnabled:boolean;brandHubEnabled:boolean}>("/api/oyama-create/brand"),[studio,setStudio]=useState(false),[hub,setHub]=useState(false),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(config.data){setStudio(config.data.studioEnabled);setHub(config.data.brandHubEnabled);}},[config.data]);
 async function save(){setBusy(true);setError("");try{await apiFetch("/api/oyama-create/studio/config",{method:"PUT",body:JSON.stringify({studioEnabled:studio,brandHubEnabled:hub,confirm:true})});setReview(false);await config.reload();window.dispatchEvent(new Event("oyama-create-config-updated"));}catch(error){setError(message(error));}finally{setBusy(false);}}
 return <><WorkspaceRollout/><section className="oc-card" style={{marginTop:20}}><div className="oc-card-heading"><h2>Studio & Brand Hub rollout</h2></div><div className="oc-card-body oc-form">{(error||config.error)&&<p className="oc-error" role="alert">{error||config.error}</p>}<label className="oc-check"><input type="checkbox" checked={studio} onChange={event=>setStudio(event.target.checked)}/>Open letter-first Studio by default for new content</label><label className="oc-check"><input type="checkbox" checked={hub} onChange={event=>setHub(event.target.checked)}/>Redirect legacy branding screens to the Create Brand Hub</label><p className="oc-help">These flags change editor defaults and navigation. Existing Studio drafts keep their structured editor and history. Public branding adopts a new revision only through its reviewed update.</p><button className="oc-button" disabled={config.loading||busy} onClick={()=>setReview(true)}>Review rollout settings</button>{review&&<Modal title="Apply organization rollout settings?" close={()=>setReview(false)}><p>Studio default: {studio?"on":"off"}. Brand Hub navigation: {hub?"on":"off"}.</p><p className="oc-help">Rollback restores the previous editor for unconverted content and the previous branding navigation. It retains all new drafts, immutable revisions and generated output. Published branding still uses reviewed changes.</p><button className="oc-button primary" disabled={busy} onClick={()=>void save()}>Apply reviewed settings</button></Modal>}</div></section></>;
}
