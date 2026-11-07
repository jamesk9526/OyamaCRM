import { CENTER_COLUMNS } from "./visit-fields.js";
import type { Request, Response } from "express";
import { prisma } from "./database.js";
import { CARE_ROLES, defaultPolicies, effectiveModules, MODULE_API_PREFIXES, type ModuleId, type ModulePolicy, type EffectiveModules } from "./contracts/modules.js";

export async function loadModulePolicies(organizationId: string): Promise<ModulePolicy[]> {
  const rows = await prisma.compassionConfiguration.findMany({ where: { organizationId, pluginKey: { startsWith: "module:" } } });
  return defaultPolicies().map(policy => {
    const row = rows.find(r => r.pluginKey === `module:${policy.id}`);
    const config = row?.config as { allowedRoles?: ModulePolicy["allowedRoles"] } | null;
    return row ? { ...policy, enabled: policy.id === "core" || row.enabled, allowedRoles: Array.isArray(config?.allowedRoles) ? config.allowedRoles.filter(role=>CARE_ROLES.includes(role)) : [] } : policy;
  });
}
export async function organizationModules(organizationId: string) { return effectiveModules(await loadModulePolicies(organizationId)); }
export function enabled(res: Response, id: ModuleId) { return (res.locals.careModules as EffectiveModules | undefined)?.[id] !== false; }

export async function endpointModules(req: Request): Promise<ModuleId[]> {
  let path: string;
  try { path = decodeURIComponent(req.originalUrl.split("?")[0]).replace(/^\/api\/compassion/, ""); }
  catch { throw Object.assign(new Error("Invalid request path"), { code: "INVALID_PATH" }); }
  if (/^\/(modules|access|bootstrap|memberships|reviewers|audit|staff|migration|merge|readiness)/.test(path)) return ["core"];
  if (/^\/intake\/[^/]+(?:\/process)?$/.test(path)) return ["casework","clinical"];
  if (["PREGNANCY_TEST","ULTRASOUND"].includes(req.body?.serviceType)) return req.body.serviceType === "ULTRASOUND" ? ["casework","clinical","ultrasounds"] : ["casework","clinical"];
  if(req.body?.metrics && CENTER_COLUMNS.some(column=>column.clinical && Object.prototype.hasOwnProperty.call(req.body.metrics,column.key))) return ["casework","clinical"];
  if (/^\/(charts|documents)/.test(path)) {
    let kind = req.body?.kind;
    const chartId = /^\/charts\/([^/]+)/.exec(path)?.[1] || req.body?.chartId;
    if (typeof chartId === "string" && chartId.length <= 191) kind = (await prisma.compassionChart.findFirst({ where: { id: chartId, organizationId: req.user!.orgId }, select: { kind: true } }))?.kind;
    const documentId = /^\/documents\/([^/]+)/.exec(path)?.[1];
    if (documentId) {
      const doc = await prisma.compassionDocument.findFirst({ where: { id: documentId, organizationId: req.user!.orgId }, select: { chartId: true, accessScope: true } });
      if (doc?.accessScope === "CASEWORK") return ["casework"];
      if (doc?.chartId) kind = (await prisma.compassionChart.findFirst({ where: { id: doc.chartId, organizationId: req.user!.orgId }, select: { kind: true } }))?.kind;
    }
    return kind === "ULTRASOUND" ? ["clinical", "ultrasounds"] : ["clinical"];
  }
  if (/\/activity-entries/.test(path)) return ["casework"];
  if (/\/points/.test(path)) return ["education"];
  if (/\/portal-access/.test(path)) return ["communications"];
  if (/^\/reports\/monthly/.test(path)) return ["reporting", "casework"];
  const prefix = path.split("/")[1];
  for (const [id,prefixes] of Object.entries(MODULE_API_PREFIXES)) if(prefixes!.includes(prefix)) return [id as ModuleId];
  return ["core"];
}
export async function checkEndpointModules(req: Request, res: Response) {
  const modules = effectiveModules(await loadModulePolicies(req.user!.orgId), res.locals.careRole);
  res.locals.careModules = modules;
  return (await endpointModules(req)).every(id => modules[id]);
}

/** Strip cross-module material from aggregate responses, including nested client/case payloads. */
export function projectModules(value: unknown, modules: EffectiveModules): unknown {
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return value.filter(row => !row || typeof row !== "object" || (!("serviceType" in row) || (row.serviceType !== "ULTRASOUND" || modules.ultrasounds && modules.clinical) && (row.serviceType !== "PREGNANCY_TEST" || modules.clinical)) && (!("recordType" in row) || (row.recordType === "chart" ? modules.clinical : modules.casework)) && (!("kind" in row) || (row.kind !== "ULTRASOUND" || modules.ultrasounds) && (!["HEALTH_PREGNANCY_INTAKE","VITALS"].includes(row.kind) || modules.clinical))).map(row => projectModules(row, modules));
  const hidden: Partial<Record<ModuleId, string[]>> = {
    casework: ["tasksDue", "followUpsThisWeek", "caseloadByStatus", "recentActivity", "upcomingFollowUps", "totalCases", "pendingFollowUps", "pendingIntakes", "casesByType", "casesByStatus", "openCases", "closedCases", "openFollowUps", "overdueFollowUps", "cases", "services", "followUps", "activities", "privateNotes", "activeCases", "incompleteIntake", "caseStatusBreakdown", "recentCases"],
    scheduling: ["noShows", "rescheduled", "appointmentsToday", "todaysAppointments", "appointmentsByType", "appointmentsThisMonth", "appointmentsLastMonth", "completedAppointmentsThisMonth", "completionRate", "monthDeltaPercent", "appointmentsInRange", "completedAppointmentsInRange", "completionRateInRange", "noShowAppointmentsInRange", "noShowRateInRange", "upcomingAppointmentsNext7Days", "appointments", "upcomingAppointments", "appointmentStatusBreakdown"],
    clinical: [...CENTER_COLUMNS.filter(c=>c.clinical).map(c=>c.key),"charts", "documents", "pendingApprovals"], education: ["points", "enrollments"], communications: ["messages"],
  };
  return Object.fromEntries(Object.entries(value).filter(([key]) => !Object.entries(hidden).some(([id, keys]) => !modules[id as ModuleId] && keys!.includes(key))).map(([key, item]) => [key, projectModules(item, modules)]));
}
