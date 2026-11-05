"use client";
import Link from "next/link";
import { CareCard,CareEmpty,CareError,useCareData } from "./care-ui";
import { FORM_TEMPLATES } from "@/server/src/compassion/form-templates";
import { formUrl } from "./forms/ClientForms";
export default function DocumentationQueue(){
 const queue=useCareData<Array<{id:string;kind:string;clientId:string;clientName:string;status:string}>>("/api/compassion/documentation-queue");
 return <CareCard title="Unfinished documentation" description="Paper drafts and clinical forms awaiting review"><CareError error={queue.error}/>{queue.loading?<CareEmpty title="Loading documentation…"/>:queue.error?<CareEmpty title="Documentation unavailable"><button className="care-button secondary" onClick={()=>void queue.reload()}>Try again</button></CareEmpty>:queue.data?.length?queue.data.map(r=><Link key={r.id} className="care-row" href={formUrl(r.clientId,r.kind,r.id)}><div className="care-row-main"><strong>{r.clientName}</strong><small>{FORM_TEMPLATES[r.kind]?.title || r.kind}</small></div><span className="care-badge">{r.status.toLowerCase()}</span></Link>):<CareEmpty title="No unfinished paper forms"/>}</CareCard>;
}
