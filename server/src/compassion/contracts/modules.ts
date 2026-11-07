/** Browser-safe extension contracts. No database, secrets, or Node imports. */
export const CARE_ROLES = ["ADMIN", "RECEPTION", "CASEWORKER", "CLINICIAN", "PHYSICIAN", "READONLY", "ULTRASOUND_REVIEWER"] as const;
export type CareRole = typeof CARE_ROLES[number];
export type CareCapability = "records" | "schedule" | "casework" | "clinical" | "sign" | "import" | "export" | "manage" | "messages";
export const roleCapabilities: Record<CareRole, readonly CareCapability[]> = {
  ADMIN: ["records", "schedule", "casework", "clinical", "import", "export", "manage", "messages"],
  RECEPTION: ["records", "schedule", "messages"], CASEWORKER: ["records", "schedule", "casework", "messages"],
  CLINICIAN: ["records", "schedule", "casework", "clinical", "messages"], PHYSICIAN: ["records", "schedule", "casework", "clinical", "sign", "messages"],
  READONLY: ["records"], ULTRASOUND_REVIEWER: [],
};
export const MODULES = [
  { id: "core", name: "Core", description: "Client files, identity, access and workspace settings", dependencies: [], capability: "records", required: true },
  { id: "casework", name: "Casework", description: "Cases, visits, intake, assistance and follow-ups", dependencies: ["core"], capability: "casework" },
  { id: "scheduling", name: "Scheduling", description: "Appointments, availability, rooms and booking", dependencies: ["core"], capability: "schedule" },
  { id: "clinical", name: "Clinical", description: "Protected charts and supporting documents", dependencies: ["core"], capability: "clinical" },
  { id: "ultrasounds", name: "Ultrasounds", description: "Examinations, scans and clinical handoffs", dependencies: ["clinical"], capability: "clinical" },
  { id: "physician-review", name: "Physician review", description: "Separate ultrasound-only physician portal", dependencies: ["ultrasounds"], capability: "sign" },
  { id: "education", name: "Education", description: "Classes, attendance, points and boutique", dependencies: ["core"], capability: "casework" },
  { id: "communications", name: "Communications", description: "Client portal, messages and letters", dependencies: ["core"], capability: "messages" },
  { id: "reporting", name: "Reporting", description: "Registers, reports and exports", dependencies: ["core"], capability: "export" },
  { id: "surveys", name: "Surveys", description: "Client surveys and response history", dependencies: ["core"], capability: "casework" },
] as const;
export type ModuleId = typeof MODULES[number]["id"];
export interface NavigationContribution { name: string; href: string; icon: string; capability: CareCapability; group: "Daily work" | "Care & support" | "Tools"; order: number }
export const MODULE_NAVIGATION: Partial<Record<ModuleId, NavigationContribution[]>> = {
  core: [{ name:"Today",href:"/compassion",icon:"LayoutGrid",capability:"records",group:"Daily work",order:0 },{ name:"Client Files",href:"/compassion/clients",icon:"Users",capability:"records",group:"Daily work",order:2 }],
  scheduling:[{name:"Schedule",href:"/compassion/appointments",icon:"CalendarDays",capability:"schedule",group:"Daily work",order:1}],
  casework:[{name:"Follow-ups",href:"/compassion/follow-ups",icon:"ClipboardCheck",capability:"casework",group:"Daily work",order:3},{name:"Cases",href:"/compassion/cases",icon:"HeartHandshake",capability:"casework",group:"Care & support",order:0},{name:"Intake",href:"/compassion/intake",icon:"ClipboardList",capability:"casework",group:"Care & support",order:1}],
  clinical:[{name:"Clinical care",href:"/compassion/care",icon:"Stethoscope",capability:"clinical",group:"Care & support",order:2}],
  ultrasounds:[{name:"Ultrasounds",href:"/compassion/ultrasounds",icon:"ScanLine",capability:"clinical",group:"Care & support",order:3}],
  education:[{name:"Classes & assistance",href:"/compassion/classes",icon:"GraduationCap",capability:"casework",group:"Care & support",order:4}],
  communications:[{name:"Messages",href:"/compassion/messages",icon:"MessageSquare",capability:"messages",group:"Care & support",order:5},{name:"Client letters",href:"/compassion/letters",icon:"FileText",capability:"casework",group:"Tools",order:1}],
  reporting:[{name:"Reports",href:"/compassion/reports",icon:"Activity",capability:"export",group:"Tools",order:2}],
  surveys:[{name:"Surveys",href:"/surveys?audience=CLIENT",icon:"ClipboardList",capability:"casework",group:"Tools",order:0}],
};
export interface ClientActionContribution { label:string; href:string; capability:CareCapability }
export const MODULE_CLIENT_ACTIONS: Partial<Record<ModuleId, ClientActionContribution[]>> = {
  casework:[{label:"New care case",href:"/compassion/clients/{clientId}?tab=cases&newCase=1{caseContext}",capability:"casework"},{label:"Record a visit",href:"/compassion/clients/{clientId}?tab=visits{caseContext}",capability:"casework"},{label:"Add a note",href:"/compassion/clients/{clientId}?tab=activity{caseContext}",capability:"casework"},{label:"Follow-ups",href:"/compassion/clients/{clientId}?tab=follow-ups{caseContext}",capability:"casework"},{label:"Assistance / referrals",href:"/compassion/clients/{clientId}?tab=assistance{caseContext}",capability:"casework"}],
  education:[{label:"Classes & boutique",href:"/compassion/classes?clientId={clientId}",capability:"casework"}],
  ultrasounds:[{label:"Ultrasounds",href:"/compassion/ultrasounds?clientId={clientId}",capability:"clinical"}],
  surveys:[{label:"Survey history",href:"/surveys/records/CLIENT/{clientId}",capability:"casework"}],
};
/** Register future feature route prefixes here alongside its UI contributions. */
export const MODULE_API_PREFIXES: Partial<Record<ModuleId, string[]>> = {
  scheduling:["appointments","resources","reservations","appointment-widget"], casework:["cases","visits","follow-ups","services","families","case-forms","case-form-documents","intake","documentation-queue"],
  ultrasounds:["ultrasounds"], education:["classes","enrollments"], communications:["messages","letters"], reporting:["reports","exports"], surveys:["surveys"],
};
export interface ModulePolicy { id: ModuleId; enabled: boolean; allowedRoles: CareRole[] }
export type EffectiveModules = Record<ModuleId, boolean>;
export const defaultPolicies = (): ModulePolicy[] => MODULES.map(m => ({ id: m.id, enabled: m.id !== "physician-review", allowedRoles: [...CARE_ROLES] }));
export function effectiveModules(policies: ModulePolicy[], role?: string): EffectiveModules {
  const result = {} as EffectiveModules;
  const organization = {} as EffectiveModules;
  for (const definition of MODULES) {
    const policy = policies.find(p => p.id === definition.id)!;
    organization[definition.id] = policy.enabled && definition.dependencies.every(id => organization[id]);
    result[definition.id] = organization[definition.id] && (!role || definition.id === "core" || policy.allowedRoles.includes(role as CareRole));
  }
  return result;
}
export function moduleForPath(path: string): ModuleId {
  if (/\/physician(?:\/|$)/.test(path)) return "physician-review";
  if (/\/(ultrasounds)(?:\/|$)/.test(path)) return "ultrasounds";
  if (/\/(care)(?:\/|$)/.test(path)) return "clinical";
  if (/\/(appointments|settings\/(resources|booking))(?:\/|$)/.test(path)) return "scheduling";
  if (/\/(cases|follow-ups|intake|families)(?:\/|$)/.test(path)) return "casework";
  if (/\/classes(?:\/|$)/.test(path)) return "education";
  if (/\/(messages|letters)(?:\/|$)/.test(path)) return "communications";
  if (/\/reports(?:\/|$)/.test(path)) return "reporting";
  if (/^\/surveys/.test(path)) return "surveys";
  return "core";
}
export const CLIENT_TABS: Array<{ id: string; label: string; module: ModuleId; capability: CareCapability }> = [
  { id: "overview", label: "Overview", module: "core", capability: "records" },
  { id: "cases", label: "Cases", module: "casework", capability: "casework" },
  { id: "visits", label: "Visits", module: "casework", capability: "casework" },
  { id: "forms", label: "Forms", module: "core", capability: "casework" },
  { id: "assistance", label: "Assistance & Education", module: "casework", capability: "casework" },
  { id: "follow-ups", label: "Follow-ups", module: "casework", capability: "casework" },
  { id: "documents", label: "Documents", module: "clinical", capability: "clinical" },
  { id: "medical", label: "Medical", module: "clinical", capability: "clinical" },
  { id: "activity", label: "Activity", module: "casework", capability: "casework" },
];
