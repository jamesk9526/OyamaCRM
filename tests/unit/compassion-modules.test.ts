import { describe, expect, it } from "vitest";
import { defaultPolicies, effectiveModules, roleCapabilities, MODULE_CLIENT_ACTIONS, MODULE_NAVIGATION } from "@/server/src/compassion/contracts/modules";
import { projectModules } from "@/server/src/compassion/module-policy";
describe("Compassion module boundaries",()=>{
  it("preserves existing defaults and requires explicit physician portal activation",()=>{
    const modules=effectiveModules(defaultPolicies());expect(modules.core).toBe(true);expect(modules.clinical).toBe(true);expect(modules["physician-review"]).toBe(false);
    expect(roleCapabilities.ULTRASOUND_REVIEWER).toEqual([]);expect(roleCapabilities.READONLY).not.toContain("clinical");
  });
  it("evaluates organization dependencies separately from a reviewer’s narrow role",()=>{
    const policies=defaultPolicies().map(p=>p.id==="physician-review"?{...p,enabled:true,allowedRoles:["ULTRASOUND_REVIEWER" as const]}:p.id==="clinical"?{...p,allowedRoles:["CLINICIAN" as const]}:p);
    const modules=effectiveModules(policies,"ULTRASOUND_REVIEWER");expect(modules.clinical).toBe(false);expect(modules["physician-review"]).toBe(true);
    expect(effectiveModules(policies.map(p=>p.id==="clinical"?{...p,enabled:false}:p),"ULTRASOUND_REVIEWER")["physician-review"]).toBe(false);
  });
  it("projects nested aggregates and medical service rows without exposing disabled modules",()=>{
    const modules=effectiveModules(defaultPolicies().map(p=>["casework","scheduling","clinical","ultrasounds"].includes(p.id)?{...p,enabled:false}:p));
    expect(projectModules({firstName:"Synthetic",cases:[{summary:"Private case"}],appointments:[{id:"a"}],_count:{cases:3,appointments:4},kpis:{activeCases:3,appointmentsThisMonth:4},facts:{metrics:{pregnant:true,bc:true}},rows:[{serviceType:"ULTRASOUND"},{serviceType:"CLOTHING"}],forms:[{recordType:"chart",kind:"VITALS"},{recordType:"casework"}]},modules)).toEqual({firstName:"Synthetic",_count:{},kpis:{},facts:{metrics:{bc:true}},rows:[{serviceType:"CLOTHING"}],forms:[]});
  });
  it("registers navigation and contextual commands independently of the shell",()=>{
    expect(MODULE_NAVIGATION.ultrasounds?.[0].href).toBe("/compassion/ultrasounds");
    expect(MODULE_CLIENT_ACTIONS.casework?.find(a=>a.label==="New care case")?.href).toContain("{caseContext}");
  });
});
