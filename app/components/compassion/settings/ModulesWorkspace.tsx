"use client";
import { useEffect, useState } from "react";
import { CARE_ROLES, MODULES, type ModulePolicy } from "@/server/src/compassion/contracts/modules";
import { CareError, CareHeading, careWrite, useCareData } from "../care-ui";
export default function ModulesWorkspace() {
  const data = useCareData<{ policies: ModulePolicy[] }>("/api/compassion/modules");
  const [policies,setPolicies] = useState<ModulePolicy[]>([]); const [busy,setBusy] = useState(false); const [error,setError] = useState(""); const [notice,setNotice] = useState("");
  useEffect(()=>{if(data.data)setPolicies(data.data.policies);},[data.data]);
  const change = (id:string, patch:Partial<ModulePolicy>) => {setNotice("");setPolicies(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));};
  return <><CareHeading title="CRM modules" description="Enable the tools your center needs and limit availability by care role. Role permissions still apply."/><CareError error={error || data.error}/>{notice&&<p role="status" className="care-notice">{notice}</p>}{data.loading ? <p role="status">Loading module configuration…</p> : data.error ? <button className="care-button" onClick={()=>void data.reload()}>Try again</button> : <form className="care-module-list" onSubmit={async e=>{e.preventDefault();if(!window.confirm("Apply these module and role restrictions? Records are preserved. Active physician sessions will be revoked."))return;setBusy(true);setError("");try{await careWrite("/modules",{policies,approve:true},"PUT");setNotice("Module settings saved. Reloading workspace access…");window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Unable to save modules.");}finally{setBusy(false);}}}>
    {MODULES.map(module=>{const policy=policies.find(p=>p.id===module.id);return policy&&<section className="care-module-row" key={module.id}><label><input type="checkbox" disabled={module.id==="core"||busy} checked={policy.enabled} onChange={e=>change(module.id,{enabled:e.target.checked})}/> <strong>{module.name}</strong></label><p>{module.description}</p>{module.dependencies.length>0&&<small>Requires: {module.dependencies.join(", ")}</small>}{module.id!=="core"&&<fieldset className="care-role-options" disabled={!policy.enabled||busy}><legend>Available to these roles</legend>{CARE_ROLES.map(role=><label key={role}><input type="checkbox" checked={policy.allowedRoles.includes(role)} onChange={e=>change(module.id,{allowedRoles:e.target.checked?[...policy.allowedRoles,role]:policy.allowedRoles.filter(r=>r!==role)})}/>{role.toLowerCase().replaceAll("_"," ")}</label>)}</fieldset>}</section>;})}
    <div className="care-actions"><button className="care-button" disabled={busy||policies.length!==MODULES.length}>Review and save modules</button></div>
  </form>}</>;
}
