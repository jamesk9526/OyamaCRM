import { createHash } from "node:crypto";
import type { Request } from "express";
import { Prisma, type ChatGptGrant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { can, assertCampaign } from "../oyama-create/access.js";
import { emailRecordAccessible } from "../oyama-create/legacy.js";
import { isTrashed } from "../oyama-create/trash-state.js";
import { taskOrganizationWhere, canAccessTask } from "../services/task-policy.js";
import { CreateError } from "../oyama-create/domain.js";
import { RESOURCES, resourceFor, resourceFields, fieldGroup, modelFields, type AiResource } from "./catalog.js";
import { policyForRequest, decideAccess, demandAccess } from "./policy.js";
import type { AccessDecision, AccessRule } from "./contracts.js";

export type DataRow = Record<string, unknown>;
/** A bounded, internally selected delegate. No client supplies model or query objects. */
export interface DataDelegate {
  findMany(args: Record<string, unknown>): Promise<DataRow[]>;
  findFirst(args: Record<string, unknown>): Promise<DataRow | null>;
  count(args: Record<string, unknown>): Promise<number>;
  create(args: Record<string, unknown>): Promise<DataRow>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
}
export const delegateFor = (res: AiResource, db: unknown = prisma): DataDelegate => {
  const name = res.model.charAt(0).toLowerCase() + res.model.slice(1);
  return (db as Record<string, DataDelegate>)[name];
};
export const asJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function recordVersion(row: DataRow) { return createHash("sha256").update(JSON.stringify(row, (_key, value: unknown) => typeof value === "bigint" ? String(value) : value)).digest("hex"); }
export function recordUrl(res: AiResource, row: DataRow, origin: string) {
  const path = res.path.replace(/:([A-Za-z]+)/g, (_match, key: string) => encodeURIComponent(String(row[key] || row.id || "")));
  return `${origin}${path}`;
}
export function parseRecordId(value: unknown) {
  if (typeof value !== "string" || value.length > 400) throw new CreateError(400, "Choose a CRM record ID returned by search.");
  const split = value.indexOf(":");
  const res = resourceFor(value.slice(0, split)), id = value.slice(split + 1);
  if (split < 1 || !res || !/^[A-Za-z0-9_-]{1,191}$/.test(id)) throw new CreateError(400, "Choose a valid resource:record ID.");
  return { res, id };
}
const modelFor = (res: AiResource) => Prisma.dmmf.datamodel.models.find(model => model.name === res.model)!;
function linkedTenantGuards(res: AiResource, org: string): DataRow[] {
  const output: DataRow[] = [];
  for (const field of modelFor(res).fields.filter(field => field.kind === "object" && !field.isList && field.relationFromFields?.length)) {
    const target = Prisma.dmmf.datamodel.models.find(model => model.name === field.type);
    if (!target || !target.fields.some(item => item.name === "organizationId") || field.type === "Organization") continue;
    const guard = { [field.name]: { organizationId: org, ...(field.type === "Constituent" ? { closedAt: null } : {}) } };
    output.push(field.isRequired ? guard : { OR: [{ [field.name]: null }, guard] });
  }
  return output;
}
export function constraintWhere(req: Request, res: AiResource, rule: AccessRule): DataRow {
  if (rule.records === "own") return res.owner ? { [res.owner]: req.user!.sub } : { id: { in: [] } };
  if (rule.records === "selected") {
    const choices: DataRow[] = [];
    if (res.key === "campaigns") choices.push({ id: { in: rule.campaignIds || [] } });
    else if (res.campaign) choices.push({ [res.campaign]: { in: rule.campaignIds || [] } });
    if (res.key === "events") choices.push({ id: { in: rule.eventIds || [] } });
    else if (res.event) choices.push({ [res.event]: { in: rule.eventIds || [] } });
    return { OR: choices.length ? choices : [{ id: { in: [] } }] };
  }
  return {};
}
export function tenantWhere(req: Request, res: AiResource): DataRow {
  const org = req.user!.orgId;
  let where: DataRow;
  switch (res.scope) {
    case "constituent": where = { constituent: { organizationId: org, closedAt: null } }; break;
    case "event": where = { event: { organizationId: org } }; break;
    case "grant": where = { grant: { organizationId: org } }; break;
    case "path": where = res.key === "path_runs" ? { enrollment: { organizationId: org, path: { crmScope: "DONOR" } } } : { path: { organizationId: org, crmScope: "DONOR" } }; break;
    case "list": where = { list: { organizationId: org } }; break;
    case "savedReport": where = { organizationId: org, pluginKey: { startsWith: `custom-report:${req.user!.sub}:` } }; break;
    case "customValue": where = { field: { organizationId: org } }; break;
    case "activity": where = { OR: [{ constituent: { organizationId: org, closedAt: null } }, { event: { organizationId: org } }, { task: { organizationId: org } }, { meeting: { organizationId: org } }], AND: linkedTenantGuards(res, org) }; break;
    default: where = { organizationId: org };
  }
  const guards = linkedTenantGuards(res, org);
  const clauses: DataRow[] = [where, ...guards, res.extra || {}];
  if (res.key === "documents") clauses.push({ userId: req.user!.sub });
  if (res.key === "tasks") clauses.push(taskOrganizationWhere(req.user!.orgId));
  if (res.key === "meetings" && req.user!.role !== "admin") clauses.push({ OR: [{ createdById: req.user!.sub }, { assignedStaffId: req.user!.sub }] });
  if (res.key === "path_enrollments") clauses.push({ path: { crmScope: "DONOR" }, constituent: { organizationId: org, closedAt: null } });
  return { AND: clauses };
}
export async function allowedFields(req: Request, res: AiResource, grant: ChatGptGrant, base?: AccessDecision) {
  const decision = base || await demandAccess(req, `${res.key}.read`, grant), fields = resourceFields(res), allowed = new Set<string>();
  const policy = await policyForRequest(req);
  const groups = new Map<string, AccessDecision>();
  for (const field of fields) {
    const group = fieldGroup(field);
    if (group !== "basic" && !groups.has(group)) groups.set(group, await decideAccess(req, `${res.key}.${group}.read`, grant, policy));
    const groupDecision = group === "basic" ? undefined : groups.get(group);
    if (groupDecision?.mode === "blocked") continue;
    if ([...decision.constraints, ...(groupDecision?.constraints || [])].some(rule => rule.fields && !rule.fields.includes(field))) continue;
    allowed.add(field);
  }
  return allowed;
}
async function rowAccessible(req: Request, res: AiResource, row: DataRow, manage = false): Promise<boolean> {
  if (res.key === "email") return emailRecordAccessible({ templateJson: row.templateJson as string | null, audienceFilter: row.audienceFilter as string | null }, req.user!.sub, req.user!.role, manage);
  if (res.key === "create_campaigns") {
    if (await isTrashed(req.user!.orgId, "CAMPAIGN", String(row.id))) return false;
    try { await assertCampaign(req, String(row.id), manage); } catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) return false; throw error; }
  }
  if (res.key === "tasks" && !canAccessTask(row as Parameters<typeof canAccessTask>[0], req.user!.sub, req.user!.role)) return false;
  if (res.key === "custom_values") {
    const target = { constituent: "constituents", donation: "gifts", campaign: "campaigns", event: "events" }[String(row.entityType).toLowerCase()];
    if (!target) return false;
    const targetRes = resourceFor(target)!;
    if (!await can(req, targetRes.permission)) return false;
    return !!await delegateFor(targetRes).findFirst({ where: { AND: [tenantWhere(req, targetRes), { id: row.entityId }] }, select: { id: true } });
  }
  return true;
}
function selectFields(res: AiResource, allowed: Set<string>) {
  const mandatory = ["id", ...resourceFields(res), ...modelFor(res).fields.filter(field => field.kind !== "object" && field.name.endsWith("Id")).map(field => field.name)];
  if (res.key === "email") mandatory.push("templateJson", "audienceFilter");
  if (res.key === "tasks") mandatory.push("organizationId", "assigneeId", "createdById");
  return Object.fromEntries([...new Set([...allowed, ...mandatory])].map(field => [field, true]));
}
export async function rawRecord(req: Request, res: AiResource, id: string, grant: ChatGptGrant, manage = false, extraConstraints: AccessRule[] = []) {
  const access = await demandAccess(req, `${res.key}.read`, grant);
  const row = await delegateFor(res).findFirst({ where: { AND: [tenantWhere(req, res), { id }, ...[...access.constraints, ...extraConstraints].map(rule => constraintWhere(req, res, rule))] }, select: selectFields(res, new Set(resourceFields(res))) });
  if (!row || !await rowAccessible(req, res, row, manage)) throw new CreateError(404, "CRM record not found or unavailable to this connection.");
  return row;
}
export async function presentRecord(req: Request, res: AiResource, row: DataRow, grant: ChatGptGrant, origin: string) {
  const allowed = await allowedFields(req, res, grant);
  const fields: DataRow = {};
  for (const field of allowed) if (row[field] !== undefined) fields[field] = row[field];
  const title = [fields.displayName, fields.name, fields.title, [fields.firstName, fields.lastName].filter(Boolean).join(" "), fields.subject, fields.receiptNumber].find(value => typeof value === "string" && value.trim()) || `${res.title} · ${String(row.id).slice(-8)}`;
  return { id: `${res.key}:${String(row.id)}`, resource: res.key, title: String(title), fields, version: recordVersion(row), url: recordUrl(res, row, origin), retrievedAt: new Date().toISOString() };
}
export async function getRecord(req: Request, grant: ChatGptGrant, compositeId: unknown, origin: string) {
  const { res, id } = parseRecordId(compositeId);
  return presentRecord(req, res, await rawRecord(req, res, id, grant), grant, origin);
}
export type RecordSearch = { resource: string; query?: string; cursor?: string; limit?: number; constituentId?: string; campaignId?: string; eventId?: string; status?: string; from?: string; through?: string };
export async function searchRecords(req: Request, grant: ChatGptGrant, input: RecordSearch, origin: string) {
  const res = resourceFor(input.resource);
  if (!res) throw new CreateError(400, "Choose an available CRM resource.");
  const access = await demandAccess(req, `${res.key}.read`, grant), allowed = await allowedFields(req, res, grant, access);
  const limit = Math.min(input.limit || 25, access.limits.maxRows);
  if (!Number.isInteger(limit) || limit < 1) throw new CreateError(400, "Choose a valid row limit.");
  const and: DataRow[] = [tenantWhere(req, res), ...access.constraints.map(rule => constraintWhere(req, res, rule))];
  if (input.cursor) {
    let cursor: { id?: string; resource?: string; query?: string };
    try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString()); } catch { throw new CreateError(400, "Invalid record cursor."); }
    if (cursor.resource !== res.key || cursor.query !== (input.query || "") || typeof cursor.id !== "string" || cursor.id.length > 191) throw new CreateError(400, "The cursor does not match this search.");
    and.push({ id: { gt: cursor.id } });
  }
  for (const key of ["constituentId", "campaignId", "eventId", "status"] as const) {
    if (!input[key]) continue;
    if (!resourceFields(res).includes(key) || !allowed.has(key)) throw new CreateError(403, `This connection cannot filter ${res.key} by ${key}.`);
    and.push({ [key]: input[key] });
  }
  if (input.from || input.through) {
    const field = ["date", "startDate", "startTime", "createdAt"].find(key => allowed.has(key));
    if (!field) throw new CreateError(403, "This resource has no accessible date filter.");
    const gte = input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined, lt = input.through ? new Date(new Date(`${input.through}T00:00:00.000Z`).getTime() + 86400000) : undefined;
    if (gte && !Number.isFinite(gte.getTime()) || lt && !Number.isFinite(lt.getTime()) || gte && lt && gte >= lt) throw new CreateError(400, "Provide an ordered YYYY-MM-DD date range.");
    and.push({ [field]: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } });
  }
  const query = (input.query || "").trim();
  if (query.length > 200) throw new CreateError(400, "Search text must be at most 200 characters.");
  if (query) {
    const searchable = res.search.filter(field => allowed.has(field) && modelFields(res).some(item => item.name === field && item.type === "String"));
    if (!searchable.length) return { items: [], nextCursor: null, resource: res.key, notice: "No text-search fields are granted for this resource." };
    const terms = query.split(/\s+/).slice(0, 8);
    and.push({ AND: terms.map(term => ({ OR: searchable.map(field => ({ [field]: { contains: term } })) })) });
  }
  const rows = await delegateFor(res).findMany({ where: { AND: and }, orderBy: { id: "asc" }, take: limit + 1, select: selectFields(res, allowed) });
  const scanned = rows.slice(0, limit), items = [];
  for (const row of scanned) if (await rowAccessible(req, res, row)) items.push(await presentRecord(req, res, row, grant, origin));
  return { items, resource: res.key, nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ resource: res.key, query: input.query || "", id: scanned.at(-1)!.id })).toString("base64url") : null, retrievedAt: new Date().toISOString() };
}
export async function globalSearch(req: Request, grant: ChatGptGrant, query: string, origin: string) {
  await demandAccess(req, "crm.search", grant);
  if (!query.trim()) throw new CreateError(400, "Provide text to find CRM records.");
  const results: { id: string; title: string; url: string }[] = [];
  for (const res of RESOURCES) {
    if ((await decideAccess(req, `${res.key}.read`, grant)).mode === "blocked") continue;
    const page = await searchRecords(req, grant, { resource: res.key, query, limit: 3 }, origin);
    results.push(...page.items.map(({ id, title, url }) => ({ id, title, url })));
    if (results.length >= 30) break;
  }
  return { results: results.slice(0, 30) };
}
export async function relatedContext(req: Request, grant: ChatGptGrant, compositeId: string, origin: string) {
  await demandAccess(req, "crm.context", grant);
  const { res, id } = parseRecordId(compositeId), record = await getRecord(req, grant, compositeId, origin);
  const related: Record<string, Awaited<ReturnType<typeof searchRecords>>> = {}, unavailable: string[] = [];
  const filter = res.key === "constituents" ? "constituentId" : res.key === "events" ? "eventId" : res.key === "campaigns" ? "campaignId" : null;
  if (filter) for (const child of RESOURCES.filter(child => resourceFields(child).includes(filter))) {
    if ((await decideAccess(req, `${child.key}.read`, grant)).mode === "blocked") { unavailable.push(child.key); continue; }
    try { related[child.key] = await searchRecords(req, grant, { resource: child.key, [filter]: id, limit: 10 }, origin); }
    catch (error) { if (error instanceof CreateError && error.status === 403) unavailable.push(child.key); else throw error; }
  }
  return { record, related, unavailableCategories: unavailable, notice: "Related results are bounded pages. Follow each nextCursor to continue. Unavailable categories do not indicate that hidden records exist." };
}
