import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { Request } from "express";
import { Prisma, type ChatGptGrant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { can, assertCampaign } from "../oyama-create/access.js";
import { emailRecordAccessible } from "../oyama-create/legacy.js";
import { isTrashed } from "../oyama-create/trash-state.js";
import { toolFingerprint } from "../chatgpt/receipts.js";
import { getWebmasterSiteById, getWebmasterPageById, listWebmasterSites, listWebmasterPages } from "../services/webmaster-store.js";
import { canAccessTask } from "../services/task-policy.js";
import { CreateError } from "../oyama-create/domain.js";
import { RESOURCES, capabilityFor, resourceFor, resourceFields, fieldGroup, modelFields, type AiResource } from "./catalog.js";
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
export function recordVersion(row: DataRow) { return toolFingerprint(JSON.parse(JSON.stringify(row, (_key, value: unknown) => typeof value === "bigint" ? String(value) : value))); }
const cursorKey = process.env.JWT_SECRET ? createHmac("sha256", process.env.JWT_SECRET).update("oyama-crm-mcp-pagination-v1").digest() : randomBytes(32);
function sealCursor(id: string, binding: Buffer) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", cursorKey, iv);
  cipher.setAAD(binding);
  const encrypted = Buffer.concat([cipher.update(id, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function openCursor(cursor: string, binding: Buffer) {
  try {
    const data = Buffer.from(cursor, "base64url");
    if (data.length < 29 || data.length > 512 || data.toString("base64url") !== cursor) throw new Error("Invalid cursor");
    const decipher = createDecipheriv("aes-256-gcm", cursorKey, data.subarray(0, 12));
    decipher.setAAD(binding);
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
  } catch { throw new CreateError(400, "The cursor does not match this search and connection. Start the search again."); }
}
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
  if (rule.customFieldIds && ["custom_fields", "custom_values"].includes(res.key)) return { [res.key === "custom_fields" ? "id" : "fieldId"]: { in: rule.customFieldIds } };
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
  if (res.key === "documents") clauses.push({ OR: [{ workspaceScope: null }, { workspaceScope: { in: ["donor", "events", "communications", "global", "DONOR", "EVENTS", "COMMUNICATIONS"] } }] });
  if (["custom_fields", "custom_values"].includes(res.key)) clauses.push(res.key === "custom_fields" ? { entityType: { in: ["constituent", "donation", "campaign", "event"] } } : { field: { entityType: { in: ["constituent", "donation", "campaign", "event"] } } });
  if (res.key === "tasks" && !["admin", "super_admin"].includes(req.user!.role)) clauses.push({ OR: [{ createdById: req.user!.sub }, { assigneeId: req.user!.sub }] });
  if (res.key === "meetings" && req.user!.role !== "admin") clauses.push({ OR: [{ createdById: req.user!.sub }, { assignedStaffId: req.user!.sub }] });
  if (res.key === "paths") clauses.push({ targetType: { not: "CLIENT" } });
  if (res.key === "path_enrollments") clauses.push({ targetType: { not: "CLIENT" }, path: { crmScope: "DONOR", targetType: { not: "CLIENT" } }, constituent: { organizationId: org, closedAt: null } });
  if (res.key === "path_steps") clauses.push({ path: { targetType: { not: "CLIENT" } } });
  return { AND: clauses };
}
function ruleMatchesRow(req: Request, res: AiResource, rule: AccessRule, row: DataRow) {
  if (rule.records === "own" && (!res.owner || row[res.owner] !== req.user!.sub)) return false;
  if (rule.customFieldIds && ["custom_fields", "custom_values"].includes(res.key) && !rule.customFieldIds.includes(String(row[res.key === "custom_fields" ? "id" : "fieldId"]))) return false;
  if (rule.records === "selected") {
    const campaign = res.key === "campaigns" ? row.id : res.campaign ? row[res.campaign] : undefined;
    const event = res.key === "events" ? row.id : res.event ? row[res.event] : undefined;
    return !!(campaign && rule.campaignIds?.includes(String(campaign)) || event && rule.eventIds?.includes(String(event)));
  }
  return true;
}
export async function fieldPermissions(req: Request, res: AiResource, grant: ChatGptGrant, base?: AccessDecision) {
  const decision = base || await demandAccess(req, `${res.key}.read`, grant), fields = resourceFields(res), allowed = new Map<string, AccessRule[]>();
  const policy = await policyForRequest(req);
  const groups = new Map<string, AccessDecision>();
  for (const field of fields) {
    const group = fieldGroup(field);
    if (group !== "basic" && !groups.has(group)) groups.set(group, await decideAccess(req, `${res.key}.${group}.read`, grant, policy));
    const groupDecision = group === "basic" ? undefined : groups.get(group);
    if (groupDecision?.mode === "blocked") continue;
    const rules = [...decision.constraints, ...(groupDecision?.constraints || [])];
    if (rules.some(rule => rule.fields && !rule.fields.includes(field))) continue;
    allowed.set(field, rules);
  }
  return allowed;
}
export async function allowedFields(req: Request, res: AiResource, grant: ChatGptGrant, base?: AccessDecision, row?: DataRow) {
  const fields = await fieldPermissions(req, res, grant, base);
  return new Set([...fields].filter(([field, rules]) => (!row || rules.every(rule => ruleMatchesRow(req, res, rule, row))) && (field !== "privateNotes" || !!row && (row.createdById === req.user!.sub || req.user!.role === "admin"))).map(([field]) => field));
}
export async function effectiveAccess(req: Request, capability: string, grant?: ChatGptGrant, selection?: { recordId?: string; field?: string }) {
  const decision = await decideAccess(req, capability, grant);
  if (!selection?.recordId && !selection?.field) return decision;
  const cap = capabilityFor(capability), res = cap?.resource ? resourceFor(cap.resource) : undefined;
  if (!res) throw new CreateError(400, "Choose a resource capability to inspect a record or field.");
  const block = (reason: string) => ({ ...decision, mode: "blocked" as const, reasons: [...new Set([...decision.reasons, reason])] });
  if (decision.mode === "blocked") return decision;
  let row: DataRow | undefined;
  if (selection.recordId) {
    if (!grant) throw new CreateError(400, "Choose a connection to inspect record access.");
    const parsed = parseRecordId(selection.recordId.includes(":") ? selection.recordId : `${res.key}:${selection.recordId}`);
    if (parsed.res !== res) throw new CreateError(400, "Choose a record of the selected resource type.");
    try { row = await rawRecord(req, res, parsed.id, grant, !cap!.read, decision.constraints); }
    catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) return block("Record ownership, CRM permissions or connection restrictions prevent access."); throw error; }
  }
  const field = selection.field;
  if (!field) return decision;
  if (!resourceFields(res).includes(field)) throw new CreateError(400, "Choose a field from the selected resource.");
  const group = fieldGroup(field), keys = [`${res.key}.read`, ...(group === "basic" ? [] : [`${res.key}.${group}.read`])];
  const constraints = [...decision.constraints];
  for (const key of keys) {
    const required = await decideAccess(req, key, grant);
    if (required.mode === "blocked") return block(`${key} is required. ${required.reasons.join(" ")}`);
    constraints.push(...required.constraints);
  }
  if (!cap!.read && !cap!.fields?.includes(field) && !(field === "notes" && cap!.handler === "note")) return block("This action cannot change that field.");
  if (constraints.some(rule => rule.fields && !rule.fields.includes(field) || row && !ruleMatchesRow(req, res, rule, row))) return block("A field or record restriction excludes this field.");
  if (field === "privateNotes" && row && row.createdById !== req.user!.sub && req.user!.role !== "admin") return block("Only the meeting author or an administrator can read private notes.");
  return decision;
}
export async function nativeRowAccessible(req: Request, res: AiResource, row: DataRow, manage = false) {
  if (!await can(req, res.permission)) return false;
  if (res.key === "email") return emailRecordAccessible({ templateJson: row.templateJson as string | null, audienceFilter: row.audienceFilter as string | null }, req.user!.sub, req.user!.role, manage);
  if (res.key === "create_campaigns" || res.key === "studio_content" || res.key === "create_releases") {
    const campaignId = String(res.key === "create_campaigns" ? row.id : row.campaignId);
    if (await isTrashed(req.user!.orgId, "CAMPAIGN", campaignId)) return false;
    if (res.key === "studio_content" && await isTrashed(req.user!.orgId, "CONTENT", String(row.id))) return false;
    try { await assertCampaign(req, campaignId, manage); } catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) return false; throw error; }
  }
  if (res.key === "tasks" && !canAccessTask(row as Parameters<typeof canAccessTask>[0], req.user!.sub, req.user!.role)) return false;
  if (res.key === "meetings" && req.user!.role !== "admin" && row.createdById !== req.user!.sub && row.assignedStaffId !== req.user!.sub) return false;
  if (res.key === "documents" && row.userId !== req.user!.sub) return false;
  if (res.key === "websites" && row.siteType === "CLIENT_RESOURCE_SITE") return false;
  if (res.key === "paths" && req.user!.role !== "admin") {
    const config = row.triggerConfig && typeof row.triggerConfig === "object" ? row.triggerConfig as DataRow : {};
    const sharing = config._sharing && typeof config._sharing === "object" ? config._sharing as DataRow : {};
    const owner = sharing.ownerUserId || row.createdByUserId;
    if (owner !== req.user!.sub && (sharing.visibility !== "organization" || manage && sharing.allowEdit !== true)) return false;
  }
  return true;
}
async function rowAccessible(req: Request, res: AiResource, row: DataRow, grant: ChatGptGrant, manage = false): Promise<boolean> {
  if (!await nativeRowAccessible(req, res, row, manage)) return false;
  const protectedParents: Record<string, [string, string][]> = {
    email_delivery: [["email", "campaignId"]],
    audience_members: [["audiences", "listId"], ["constituents", "constituentId"]],
    group_members: [["groups", "groupId"], ["constituents", "constituentId"]],
    activities: [["constituents", "constituentId"], ["gifts", "donationId"], ["tasks", "taskId"], ["meetings", "meetingId"], ["events", "eventId"]],
    path_runs: [["path_enrollments", "enrollmentId"]],
    path_steps: [["paths", "pathId"]],
    path_enrollments: [["paths", "pathId"], ["constituents", "constituentId"]],
    web_pages: [["websites", "siteId"]],
  };
  for (const [key, relation] of protectedParents[res.key] || []) if (row[relation]) {
    try { await rawRecord(req, resourceFor(key)!, String(row[relation]), grant); }
    catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) return false; throw error; }
  }
  if (res.key === "custom_values") {
    const target = { constituent: "constituents", donation: "gifts", campaign: "campaigns", event: "events" }[String(row.entityType).toLowerCase()];
    if (!target) return false;
    const targetRes = resourceFor(target)!;
    if (!await can(req, targetRes.permission)) return false;
    try { await rawRecord(req, targetRes, String(row.entityId), grant); return true; }
    catch (error) { if (error instanceof CreateError && [403, 404].includes(error.status)) return false; throw error; }
  }
  return true;
}
function selectFields(res: AiResource, allowed: Set<string>) {
  const mandatory = ["id", ...resourceFields(res), ...modelFor(res).fields.filter(field => field.kind !== "object" && field.name.endsWith("Id")).map(field => field.name)];
  if (res.key === "email") mandatory.push("templateJson", "audienceFilter");
  if (res.key === "paths") mandatory.push("triggerConfig", "triggerType");
  if (res.key === "tasks") mandatory.push("organizationId", "assigneeId", "createdById");
  return Object.fromEntries([...new Set([...allowed, ...mandatory])].map(field => [field, true]));
}
export async function rawRecord(req: Request, res: AiResource, id: string, grant: ChatGptGrant, manage = false, extraConstraints: AccessRule[] = []) {
  const access = await demandAccess(req, `${res.key}.read`, grant);
  const constraints = [...access.constraints, ...extraConstraints];
  const site = res.key === "websites" ? await getWebmasterSiteById({ organizationId: req.user!.orgId, siteId: id }) : res.key === "web_pages" ? await getWebmasterPageById({ organizationId: req.user!.orgId, pageId: id }) : undefined;
  const row = site !== undefined ? site as unknown as DataRow | null : await delegateFor(res).findFirst({ where: { AND: [tenantWhere(req, res), { id }, ...constraints.map(rule => constraintWhere(req, res, rule))] }, select: selectFields(res, new Set(resourceFields(res))) });
  if (!row || !constraints.every(rule => ruleMatchesRow(req, res, rule, row)) || !await rowAccessible(req, res, row, grant, manage)) throw new CreateError(404, "CRM record not found or unavailable to this connection.");
  return row;
}
export async function presentRecord(req: Request, res: AiResource, row: DataRow, grant: ChatGptGrant, origin: string) {
  const allowed = await allowedFields(req, res, grant, undefined, row);
  const fields: DataRow = {};
  const truncatedFields: string[] = [];
  for (const field of allowed) {
    if (row[field] === undefined) continue;
    const value = row[field];
    const json = value && typeof value === "object" && !(value instanceof Date) && !Prisma.Decimal.isDecimal(value) ? JSON.stringify(value) : null;
    if (typeof value === "string" && value.length > 8000 || json && json.length > 8000) {
      truncatedFields.push(field);
      fields[field] = (typeof value === "string" ? value : json!).slice(0, 8000);
    } else fields[field] = value;
  }
  const title = [fields.displayName, fields.name, fields.title, [fields.firstName, fields.lastName].filter(Boolean).join(" "), fields.subject, fields.receiptNumber].find(value => typeof value === "string" && value.trim()) || `${res.title} · ${String(row.id).slice(-8)}`;
  return { id: `${res.key}:${String(row.id)}`, resource: res.key, title: String(title).slice(0, 300), fields, version: recordVersion(row), url: recordUrl(res, row, origin), retrievedAt: new Date().toISOString(), ...(truncatedFields.length ? { truncatedFields } : {}) };
}
export async function getRecord(req: Request, grant: ChatGptGrant, compositeId: unknown, origin: string) {
  const { res, id } = parseRecordId(compositeId);
  return presentRecord(req, res, await rawRecord(req, res, id, grant), grant, origin);
}
export async function readRecordField(req: Request, grant: ChatGptGrant, compositeId: unknown, field: string, offset: number, origin: string) {
  const { res, id } = parseRecordId(compositeId);
  const row = await rawRecord(req, res, id, grant);
  if (!(await allowedFields(req, res, grant, undefined, row)).has(field)) throw new CreateError(403, "This connection cannot read that field.");
  const value = row[field];
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return { id: `${res.key}:${id}`, field, text: text.slice(offset, offset + 8000), nextOffset: offset + 8000 < text.length ? offset + 8000 : null, version: recordVersion(row), url: recordUrl(res, row, origin) };
}
export const RECORD_FILTERS = ["constituentId", "campaignId", "eventId", "taskId", "meetingId", "grantId", "groupId", "pathId", "siteId", "householdId", "listId", "entityId", "entityType", "status"] as const;
export type RecordSearch = { resource: string; query?: string; cursor?: string; limit?: number; from?: string; through?: string; chronological?: boolean } & Partial<Record<typeof RECORD_FILTERS[number], string>>;
export async function searchRecords(req: Request, grant: ChatGptGrant, input: RecordSearch, origin: string) {
  const res = resourceFor(input.resource);
  if (!res) throw new CreateError(400, "Choose an available CRM resource.");
  const access = await demandAccess(req, `${res.key}.read`, grant), fieldAccess = await fieldPermissions(req, res, grant, access);
  const limit = Math.min(input.limit || 25, access.limits.maxRows);
  if (!Number.isInteger(limit) || limit < 1) throw new CreateError(400, "Choose a valid row limit.");
  const and: DataRow[] = [tenantWhere(req, res), ...access.constraints.map(rule => constraintWhere(req, res, rule))];
  const binding = Buffer.from(toolFingerprint([grant.id, { ...input, cursor: undefined, limit: undefined }]));
  const cursor = input.cursor ? openCursor(input.cursor, binding) : "";
  let after = cursor, afterTime: Date | undefined;
  if (input.chronological && cursor) {
    const separator = cursor.indexOf("|");
    after = cursor.slice(0, separator); afterTime = new Date(cursor.slice(separator + 1));
    if (separator < 1 || !Number.isFinite(afterTime.getTime())) throw new CreateError(400, "Start the timeline again.");
  }
  if (input.chronological && !fieldAccess.has("createdAt")) throw new CreateError(403, "Timeline ordering requires access to activity dates.");
  for (const key of RECORD_FILTERS) {
    if (!input[key]) continue;
    if (!resourceFields(res).includes(key) || !fieldAccess.has(key)) throw new CreateError(403, `This connection cannot filter ${res.key} by ${key}.`);
    const field = modelFields(res).find(field => field.name === key);
    const values = field && Prisma.dmmf.datamodel.enums.find(item => item.name === field.type)?.values;
    if (values && !values.some(value => value.name === input[key])) throw new CreateError(400, `Choose a valid ${key} for ${res.key}.`);
    and.push({ [key]: input[key] }, ...fieldAccess.get(key)!.map(rule => constraintWhere(req, res, rule)));
  }
  if (input.from || input.through) {
    const field = ["date", "startDate", "startTime", "createdAt"].find(key => fieldAccess.has(key));
    if (!field) throw new CreateError(403, "This resource has no accessible date filter.");
    const gte = calendarDay(input.from), last = calendarDay(input.through), lt = last && new Date(last.getTime() + 86400000);
    if (gte && lt && gte >= lt) throw new CreateError(400, "Provide an ordered YYYY-MM-DD date range.");
    and.push({ [field]: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } }, ...fieldAccess.get(field)!.map(rule => constraintWhere(req, res, rule)));
  }
  const query = (input.query || "").trim();
  if (query.length > 200) throw new CreateError(400, "Search text must be at most 200 characters.");
  if (query) {
    const searchable = res.search.filter(field => fieldAccess.has(field) && modelFields(res).some(item => item.name === field && item.type === "String"));
    if (!searchable.length) return { items: [], nextCursor: null, resource: res.key, notice: "No text-search fields are granted for this resource." };
    const terms = query.split(/\s+/).slice(0, 8);
    and.push({ AND: terms.map(term => ({ OR: searchable.map(field => ({ AND: [{ [field]: { contains: term.replace(/[\\%_]/g, "\\$&") } }, ...fieldAccess.get(field)!.map(rule => constraintWhere(req, res, rule))] })) })) });
  }
  const items = [];
  let size = 0, more = false, scanLimitReached = false;
  const scanSize = Math.max(25, limit + 1), web = ["websites", "web_pages"].includes(res.key);
  for (let scan = 0; scan < 4; scan++) {
    const continuation = afterTime ? { OR: [{ createdAt: { lt: afterTime } }, { createdAt: afterTime, id: { lt: after } }] } : after ? { id: { gt: after } } : {};
    const rows = web ? await loadWebRecords(req, res, input, after, scanSize) : await delegateFor(res).findMany({ where: { AND: [...and, continuation] }, orderBy: input.chronological ? [{ createdAt: "desc" }, { id: "desc" }] : { id: "asc" }, take: scanSize, select: selectFields(res, new Set(fieldAccess.keys())) });
    for (const row of rows) {
      if ((!web || matchesWebRecord(req, res, row, input, access, fieldAccess)) && await rowAccessible(req, res, row, grant)) {
        const item = await presentRecord(req, res, row, grant, origin), bytes = JSON.stringify(item).length;
        if (items.length === limit || items.length && size + bytes > 65000) { more = true; break; }
        items.push(item); size += bytes;
      }
      after = String(row.id);
      if (input.chronological) afterTime = new Date(row.createdAt as Date);
    }
    if (more || rows.length < scanSize) break;
    if (scan === 3) scanLimitReached = true;
  }
  const nextPosition = afterTime ? `${after}|${afterTime.toISOString()}` : after;
  return { items, resource: res.key, nextCursor: more || scanLimitReached ? sealCursor(nextPosition, binding) : null, ...(scanLimitReached ? { notice: "The scan limit was reached. Continue with nextCursor to check the remaining range." } : {}), retrievedAt: new Date().toISOString() };
}
export async function recordTimeline(req: Request, grant: ChatGptGrant, id: unknown, cursor: string | undefined, limit: number | undefined, origin: string) {
  const parsed = parseRecordId(id);
  await rawRecord(req, parsed.res, parsed.id, grant);
  const filter = { constituents: "constituentId", events: "eventId", tasks: "taskId", meetings: "meetingId" }[parsed.res.key];
  if (!filter) throw new CreateError(400, "Choose a constituent, event, task or meeting for its CRM activity timeline.");
  return searchRecords(req, grant, { resource: "activities", [filter]: parsed.id, cursor, limit, chronological: true }, origin);
}
function calendarDay(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CreateError(400, "Use valid YYYY-MM-DD dates.");
  return date;
}
async function loadWebRecords(req: Request, res: AiResource, input: RecordSearch, afterId: string, limit: number) {
  const organizationId = req.user!.orgId;
  const rows = res.key === "websites" ? await listWebmasterSites({ organizationId, afterId, limit }) : await listWebmasterPages({ organizationId, siteId: input.siteId, afterId, limit });
  return rows as unknown as DataRow[];
}
function matchesWebRecord(req: Request, res: AiResource, row: DataRow, input: RecordSearch, access: AccessDecision, fields: Map<string, AccessRule[]>) {
  if (!access.constraints.every(rule => ruleMatchesRow(req, res, rule, row))) return false;
  for (const key of RECORD_FILTERS) if (input[key] && (row[key] !== input[key] || !fields.get(key)?.every(rule => ruleMatchesRow(req, res, rule, row)))) return false;
  const from = calendarDay(input.from), through = calendarDay(input.through);
  if (from || through) {
    const created = new Date(String(row.createdAt));
    if (!fields.get("createdAt")?.every(rule => ruleMatchesRow(req, res, rule, row)) || from && created < from || through && created.getTime() >= through.getTime() + 86400000) return false;
  }
  const terms = (input.query || "").trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  return terms.every(term => res.search.some(field => fields.get(field)?.every(rule => ruleMatchesRow(req, res, rule, row)) && String(row[field] || "").toLowerCase().includes(term)));
}
export async function globalSearch(req: Request, grant: ChatGptGrant, query: string, origin: string) {
  await demandAccess(req, "crm.search", grant);
  if (!query.trim()) throw new CreateError(400, "Provide text to find CRM records.");
  const results: { id: string; title: string; url: string }[] = [];
  let incomplete = false;
  for (const res of RESOURCES) {
    if ((await decideAccess(req, `${res.key}.read`, grant)).mode === "blocked") continue;
    const page = await searchRecords(req, grant, { resource: res.key, query, limit: 3 }, origin);
    if (page.nextCursor) incomplete = true;
    results.push(...page.items.map(({ id, title, url }) => ({ id, title, url })));
    if (results.length >= 30) { incomplete = true; break; }
  }
  return { results: results.slice(0, 30), incomplete, ...(incomplete ? { notice: "Cross-module search returns a sample. Use search_crm_records and follow its cursors for a complete resource search." } : {}) };
}
export async function relatedContext(req: Request, grant: ChatGptGrant, compositeId: string, origin: string) {
  await demandAccess(req, "crm.context", grant);
  const { res, id } = parseRecordId(compositeId), record = await getRecord(req, grant, compositeId, origin);
  const related: Record<string, Awaited<ReturnType<typeof searchRecords>>> = {}, unavailable: string[] = [];
  const filters: Record<string, typeof RECORD_FILTERS[number]> = { constituents: "constituentId", groups: "groupId", events: "eventId", campaigns: "campaignId", create_campaigns: "campaignId", email: "campaignId", grants: "grantId", paths: "pathId", websites: "siteId", audiences: "listId", households: "householdId" };
  const filter = filters[res.key];
  if (filter) for (const child of RESOURCES.filter(child => resourceFields(child).includes(filter))) {
    if (filter === "campaignId" && (res.key === "email" ? child.key !== "email_delivery" : res.key === "create_campaigns" ? !["studio_content", "create_releases"].includes(child.key) : ["email_delivery", "studio_content", "create_releases"].includes(child.key))) continue;
    if ((await decideAccess(req, `${child.key}.read`, grant)).mode === "blocked") { unavailable.push(child.key); continue; }
    try { related[child.key] = await searchRecords(req, grant, { resource: child.key, [filter]: id, limit: 10 }, origin); }
    catch (error) { if (error instanceof CreateError && error.status === 403) unavailable.push(child.key); else throw error; }
  }
  const parentFields = { householdId: "households", campaignId: "campaigns", eventId: "events", constituentId: "constituents", funderId: "funders", pathId: "paths", siteId: "websites" };
  const parents = [];
  for (const [field, key] of Object.entries(parentFields)) if (typeof record.fields[field] === "string" && (field !== "campaignId" || !["email_delivery", "studio_content", "create_releases"].includes(res.key))) {
    try { parents.push(await getRecord(req, grant, `${key}:${record.fields[field]}`, origin)); }
    catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
  }
  const customType = { constituents: "constituent", gifts: "donation", campaigns: "campaign", events: "event" }[res.key];
  if (customType && (await decideAccess(req, "custom_values.read", grant)).mode !== "blocked") {
    try { related.custom_values = await searchRecords(req, grant, { resource: "custom_values", entityId: id, entityType: customType, limit: 10 }, origin); }
    catch (error) { if (error instanceof CreateError && error.status === 403) unavailable.push("custom_values"); else throw error; }
  }
  const tags = [];
  if (res.key === "constituents" && (await decideAccess(req, "tags.read", grant)).mode !== "blocked") {
    const tagged = await prisma.constituentTag.findMany({ where: { constituentId: id, tag: { organizationId: req.user!.orgId } }, select: { tagId: true }, orderBy: { tagId: "asc" }, take: 101 });
    if (tagged.length > 100) throw new CreateError(413, "This record has more than 100 tag relationships. Review its tags in CRM.");
    for (const tag of tagged) {
      try { tags.push(await getRecord(req, grant, `tags:${tag.tagId}`, origin)); }
      catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
    }
  }
  return { record, parents, related, tags, unavailableCategories: unavailable, notice: "Related results are bounded pages. Follow each nextCursor to continue. Unavailable categories do not indicate that hidden records exist." };
}
