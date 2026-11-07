"use client";
import Link from "next/link";
import { FORM_TEMPLATES } from "@/server/src/compassion/form-templates";
import { CareCard, CareEmpty, CareError, useCareData } from "../care-ui";
import { useSearchParams } from "next/navigation";
import { careModuleAvailable, useCareAccess } from "../CompassionShell";
export interface FormSummary { id: string; kind: string; status: string; version: number; createdAt: string; recordType: "chart" | "casework"; caseId?: string; visitId?: string }
export function formUrl(clientId: string, kind: string, id = "new", context = "") { return `/compassion/clients/${encodeURIComponent(clientId)}/forms/${encodeURIComponent(id)}?kind=${encodeURIComponent(kind)}${context}`; }
export default function ClientForms({ clientId, clinicalOnly = false, caseId = "" }: { clientId: string; clinicalOnly?: boolean; caseId?: string }) {
  const params = useSearchParams(); const selectedCase = caseId || params.get("caseId") || ""; const context = selectedCase ? `&caseId=${encodeURIComponent(selectedCase)}` : "";
  const access = useCareAccess(); const records = useCareData<FormSummary[]>(`/api/compassion/clients/${encodeURIComponent(clientId)}/forms`);
  const templates = Object.entries(FORM_TEMPLATES).filter(([, t]) => (!clinicalOnly || t.capability === "clinical") && careModuleAvailable(access,t.capability === "clinical" ? "clinical" : "casework") && access?.capabilities.includes(t.capability));
  const rows = records.data?.filter(r => (!clinicalOnly || r.recordType === "chart") && (!selectedCase || r.caseId === selectedCase));
  return <div className="care-stack"><CareCard title={clinicalOnly ? "Medical forms" : "Client forms"} description="Paper intake and connected care records"><div className="care-card-body care-actions">{templates.filter(([kind])=>["CASE_INTAKE","HEALTH_PREGNANCY_INTAKE"].includes(kind)).map(([kind,t]) => <Link key={kind} className="care-button secondary" href={formUrl(clientId,kind,"new",context)}>+ {t.title}</Link>)}</div><CareError error={records.error} />{records.loading ? <CareEmpty title="Loading forms…" /> : records.error ? <CareEmpty title="Forms unavailable"><button className="care-button secondary" onClick={() => void records.reload()}>Try again</button></CareEmpty> : rows?.length ? rows.map(row => <Link key={row.id} className="care-row" href={formUrl(clientId,row.kind,row.id,context)}><div className="care-row-main"><strong>{FORM_TEMPLATES[row.kind]?.title ?? row.kind}</strong><small>{new Date(row.createdAt).toLocaleDateString()} · revision {row.version}{row.visitId ? " · linked visit" : ""}</small></div><span className="care-badge">{row.status.toLowerCase()}</span><span>Open →</span></Link>) : <CareEmpty title="No forms recorded">Choose a form above to begin.</CareEmpty>}</CareCard></div>;
}
