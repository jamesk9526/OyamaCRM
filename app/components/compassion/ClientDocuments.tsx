"use client";
import { apiFetch } from "@/app/lib/auth-client";
import { useState } from "react";
import { CareCard,CareError,downloadCareFile,useCareData } from "./care-ui";
import { useCareAccess } from "./CompassionShell";
import ClientForms from "./forms/ClientForms";
export default function ClientDocuments({clientId}:{clientId:string}) {
 const access=useCareAccess();const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 const documents=useCareData<Array<{id:string;name:string;mimeType:string;size:number}>>(access?.capabilities.includes("clinical")?`/api/compassion/documents?clientId=${encodeURIComponent(clientId)}`:null);
 return <div className="care-stack"><CareCard title="Protected documents" description="Signed casework originals are attached to their form. Clinical files require clinical access."><div className="care-card-body"><CareError error={error||documents.error}/>{documents.loading?<p role="status">Loading documents…</p>:documents.data?.map(d=><div className="care-row" key={d.id}><strong>{d.name}</strong><button className="care-button secondary" disabled={busy} onClick={async()=>{setBusy(true);try{downloadCareFile(await apiFetch(`/api/compassion/documents/${d.id}/download`));}catch(e){setError(e instanceof Error?e.message:"Download failed.");}finally{setBusy(false);}}}>Download</button></div>)}</div></CareCard><ClientForms clientId={clientId}/></div>;
}
