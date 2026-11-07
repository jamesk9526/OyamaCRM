"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MODULE_CLIENT_ACTIONS, type ModuleId } from "@/server/src/compassion/contracts/modules";
import { FORM_TEMPLATES } from "@/server/src/compassion/form-templates";
import { useCareAccess, careModuleAvailable } from "./CompassionShell";
import { useCurrentClient } from "./ClientFileContext";
import { formUrl } from "./forms/ClientForms";

export default function ClientTaskRail() {
  const path = usePathname(); const params = useSearchParams(); const access = useCareAccess();
  const match = /^\/compassion\/clients\/([^/]+)/.exec(path);
  const id = match && match[1] !== "merge" ? match[1] : "";
  const client = useCurrentClient();
  if (!id) return null;
  const caseId = params.get("caseId") || "";
  const context = caseId ? `&caseId=${encodeURIComponent(caseId)}` : "";
  const file = (tab: string) => `/compassion/clients/${id}?tab=${tab}${context}`;
  return <details className="care-client-tools" open><summary>Current client</summary><div>
    <Link className="care-rail-client" href={file("overview")}>{client.data ? `${client.data.preferredName || client.data.firstName} ${client.data.lastName}` : "Client file"}</Link>
    {caseId && <small>Case {client.data?.cases?.find(c => c.id === caseId)?.caseNumber || "selected"}</small>}
    <details><summary>Add a form</summary><div>{Object.entries(FORM_TEMPLATES).filter(([, t]) => access?.capabilities.includes(t.capability) && careModuleAvailable(access, t.capability === "clinical" ? "clinical" : "casework")).map(([kind,t]) => <Link key={kind} href={formUrl(id,kind,"new",context)}>{t.title}</Link>)}</div></details>
    {Object.entries(MODULE_CLIENT_ACTIONS).filter(([key])=>careModuleAvailable(access,key as ModuleId)).flatMap(([key,actions])=>actions.filter(action=>access?.capabilities.includes(action.capability)).map(action=><Link key={`${key}:${action.label}`} href={action.href.replaceAll("{clientId}",encodeURIComponent(id)).replaceAll("{caseContext}",context)}>{action.label}</Link>))}
  </div></details>;
}
