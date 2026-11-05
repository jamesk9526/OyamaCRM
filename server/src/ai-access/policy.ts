import type { Request } from "express";
import type { ChatGptGrant, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { ROLE_HIERARCHY } from "../middleware/requireRole.js";
import { CreateError } from "../oyama-create/domain.js";
import { readMcpPolicy } from "../chatgpt/policy.js";
import { CAPABILITIES, LEGACY_TOOLS, AI_READ_SCOPE, AI_WRITE_SCOPE, oauthScopesFor, capabilityFields, capabilityFor, resourceFor, resourceFields, type AccessMode } from "./catalog.js";
import { emptyAccessDocument, DEFAULT_LIMITS, pendingOperationStatuses, type AccessDecision, type AccessDocument, type AccessRule, type RuleSet, type ConsentSnapshot, type AccessLimits } from "./contracts.js";

export const AI_POLICY_KEY = "ai-access-policy-v1";
const rank: Record<AccessMode, number> = { blocked: 0, approval: 1, automatic: 2 };
const requestPolicies = new WeakMap<Request, Promise<Awaited<ReturnType<typeof accessPolicy>>>>();
const requestMcp = new WeakMap<Request, ReturnType<typeof readMcpPolicy>>();
const requestPermissions = new WeakMap<Request, Promise<Map<string, boolean>>>();
async function currentPermission(req: Request, key: PermissionKey) {
  let permissions = requestPermissions.get(req);
  if (!permissions) {
    permissions = prisma.userPermission.findMany({ where: { userId: req.user!.sub }, select: { permission: true, granted: true } }).then(rows => new Map(rows.map(row => [row.permission, row.granted])));
    requestPermissions.set(req, permissions);
  }
  return (await permissions).get(key) ?? hasDefaultPermission(req.user!.role, key);
}
export function policyForRequest(req: Request) { let value = requestPolicies.get(req); if (!value) { value = accessPolicy(req.user!.orgId); requestPolicies.set(req, value); } return value; }
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export async function accessPolicy(org: string) {
  const row = await prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: AI_POLICY_KEY } } });
  const data = record(row?.config);
  return { revision: Number.isInteger(data.revision) ? Number(data.revision) : 0, document: row ? validateDocument(data.document) : emptyAccessDocument(), row };
}
function ruleSet(input: unknown): RuleSet {
  const data = record(input), result: RuleSet = {};
  if (Object.keys(data).length > CAPABILITIES.length) throw new CreateError(400, "Too many scope rules.");
  for (const [key, raw] of Object.entries(data)) {
    const cap = capabilityFor(key), value = record(raw);
    if (!cap || !["blocked", "approval", "automatic"].includes(String(value.mode)) || cap.read && value.mode === "approval") throw new CreateError(400, `Choose a supported access mode for ${key}.`);
    if (Object.keys(value).some(field => !["mode", "records", "campaignIds", "eventIds", "fields", "customFieldIds"].includes(field))) throw new CreateError(400, "Unknown scope restriction.");
    if (value.records !== undefined && !["all", "own", "selected"].includes(String(value.records))) throw new CreateError(400, "Choose a supported record restriction.");
    const rule: AccessRule = { mode: value.mode as AccessMode };
    if (value.records) rule.records = value.records as AccessRule["records"];
    for (const list of ["campaignIds", "eventIds", "fields", "customFieldIds"] as const) {
      if (value[list] === undefined) continue;
      if (!Array.isArray(value[list]) || value[list].length > 200 || value[list].some(v => typeof v !== "string" || !v || v.length > 191)) throw new CreateError(400, "Provide bounded scope restriction lists.");
      rule[list] = [...new Set(value[list] as string[])];
    }
    const res = cap.resource ? resourceFor(cap.resource) : undefined;
    if (rule.records === "own" && !res?.owner) throw new CreateError(400, `${key} does not have an ownership restriction.`);
    if (rule.records === "selected" && !res?.campaign && !res?.event && !["campaigns", "events"].includes(res?.key || "")) throw new CreateError(400, `${key} cannot be restricted by campaign or event.`);
    if (rule.fields && (!res || rule.fields.some(field => !capabilityFields(cap).includes(field) && !resourceFields(res).includes(field)))) throw new CreateError(400, `Unknown field restriction for ${key}.`);
    if (rule.customFieldIds && key === "custom_fields.create") throw new CreateError(400, "Individual custom field restrictions apply to existing fields. Configure field creation separately.");
    result[key] = rule;
  }
  return result;
}
export function validateDocument(input: unknown): AccessDocument {
  const raw = record(input), result = emptyAccessDocument();
  if (raw.version !== 1 || Object.keys(raw).some(key => !["version", "organization", "roles", "users", "connections", "limits"].includes(key))) throw new CreateError(400, "Use the current AI access policy format.");
  result.organization = ruleSet(raw.organization);
  for (const target of ["roles", "users", "connections"] as const) {
    const sets = record(raw[target]);
    if (Object.keys(sets).length > 500) throw new CreateError(400, "Too many policy subjects.");
    for (const [id, rules] of Object.entries(sets)) {
      if (!id || id.length > 191 || ["__proto__", "constructor", "prototype"].includes(id)) throw new CreateError(400, "Invalid policy subject.");
      result[target][id] = ruleSet(rules);
    }
  }
  const limits = record(raw.limits);
  const bounds = { maxRows: [1, 100], maxBatch: [1, 100], maxRecipients: [1, 10000], maxExport: [1, 10000], dailyImages: [0, 10] };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof AccessLimits)[]) {
    const value = limits[key] ?? DEFAULT_LIMITS[key], [minimum, maximum] = bounds[key];
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new CreateError(400, `Choose a valid ${key} limit.`);
    result.limits[key] = Number(value);
  }
  return result;
}
export function ensureConnectionReduction(before: RuleSet, after: RuleSet) {
  for (const [key, rule] of Object.entries(before)) {
    const next = after[key];
    if (!next || rank[next.mode] > rank[rule.mode]) throw new CreateError(403, "Connection restrictions can only be reduced. Reconnect for broader access.");
    if (rule.records && rule.records !== "all" && next.records !== rule.records) throw new CreateError(403, "Keep the connection's current record restriction or reconnect.");
    for (const field of ["fields", "customFieldIds", "campaignIds", "eventIds"] as const) if (rule[field] && (!next[field] || next[field].some(value => !rule[field]!.includes(value)))) throw new CreateError(403, "A connection's field or record list can only be narrowed.");
  }
}
function accessNarrowed(previous: AccessDecision, current: AccessDecision) {
  if (rank[current.mode] < rank[previous.mode]) return true;
  if (previous.mode === "blocked") return false;
  const losesFields = (key: "fields" | "customFieldIds") => current.constraints.some(rule => rule[key] && !previous.constraints.some(prior => prior[key]?.every(value => rule[key]!.includes(value))));
  const losesRecords = current.constraints.some(rule => {
    if (rule.records === "own") return !previous.constraints.some(prior => prior.records === "own");
    if (rule.records !== "selected") return false;
    return !previous.constraints.some(prior => prior.records === "selected" && (prior.campaignIds || []).every(id => rule.campaignIds?.includes(id)) && (prior.eventIds || []).every(id => rule.eventIds?.includes(id)));
  });
  return losesRecords || losesFields("fields") || losesFields("customFieldIds");
}
export async function cancelWorkAfterPolicyChange(tx: Prisma.TransactionClient, organizationId: string, before: AccessDocument, after: AccessDocument, grantId?: string) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const scope = { organizationId, ...(grantId ? { grantId } : {}) };
  const [operations, images] = await Promise.all([
    tx.aiOperation.findMany({ where: { ...scope, status: { in: pendingOperationStatuses } }, select: { grantId: true }, distinct: ["grantId"] }),
    tx.chatGptImageJob.findMany({ where: { ...scope, status: "QUEUED" }, select: { grantId: true }, distinct: ["grantId"] }),
  ]);
  const ids = [...new Set([...operations, ...images].map(row => row.grantId))];
  if (!ids.length) return;
  const grants = await tx.chatGptGrant.findMany({ where: { id: { in: ids }, organizationId, revokedAt: null }, select: { id: true, userId: true, scopes: true, consentJson: true } });
  const users = await tx.user.findMany({ where: { id: { in: grants.map(grant => grant.userId) }, organizationId }, select: { id: true, role: true } });
  const roles = new Map(users.map(user => [user.id, user.role]));
  const blockedOperations: string[] = [], blockedImages: string[] = [];
  for (const grant of grants) {
    const role = roles.get(grant.userId);
    if (!role) continue;
    const actor = { sub: grant.userId, role };
    const narrower = (key: string) => accessNarrowed(resolvePolicy(before, key, actor, grant), resolvePolicy(after, key, actor, grant));
    const limitsReduced = (["maxBatch", "maxRecipients", "maxExport", "dailyImages"] as const).some(key => after.limits[key] < before.limits[key]);
    if (limitsReduced || CAPABILITIES.some(cap => narrower(cap.key))) blockedOperations.push(grant.id);
    if (after.limits.dailyImages < before.limits.dailyImages || narrower("images.generate")) blockedImages.push(grant.id);
  }
  if (blockedOperations.length) await tx.aiOperation.updateMany({ where: { organizationId, grantId: { in: blockedOperations }, status: { in: pendingOperationStatuses } }, data: { status: "CANCELLED", finishedAt: new Date(), reviewReason: "AI access was reduced before execution. Prepare a new command under the current policy." } });
  if (blockedImages.length) await tx.chatGptImageJob.updateMany({ where: { organizationId, grantId: { in: blockedImages }, status: "QUEUED" }, data: { status: "FAILED", error: "Image generation access was reduced before execution.", prompt: null } });
}
export async function saveAccessPolicy(req: Request, revision: unknown, input: unknown) {
  if (req.user?.role !== "admin") throw new CreateError(403, "Only an organization administrator may change AI access.");
  const org = req.user.orgId, current = await accessPolicy(org), document = validateDocument(input);
  if (revision !== current.revision) throw new CreateError(409, "AI access changed in another session. Reload before saving.");
  const users = Object.keys(document.users), grants = Object.keys(document.connections);
  for (const [id, prior] of Object.entries(current.document.connections)) ensureConnectionReduction(prior, document.connections[id] || {});
  if (users.length && await prisma.user.count({ where: { id: { in: users }, organizationId: org } }) !== users.length || grants.length && await prisma.chatGptGrant.count({ where: { id: { in: grants }, organizationId: org } }) !== grants.length) throw new CreateError(400, "Policy subjects must belong to this organization.");
  if (Object.keys(document.roles).some(role => !["admin", "manager", "staff", "readonly", "report_viewer", "shareview_user"].includes(role))) throw new CreateError(400, "Unknown CRM role.");
  const next = current.revision + 1, config = { revision: next, document } as unknown as Prisma.InputJsonValue;
  try {
    await prisma.$transaction(async tx => {
      if (current.row) {
        const changed = await tx.pluginSetting.updateMany({ where: { id: current.row.id, updatedAt: current.row.updatedAt }, data: { config, updatedAt: new Date(Math.max(Date.now(), current.row.updatedAt.getTime() + 1)) } });
        if (!changed.count) throw new CreateError(409, "AI access changed in another session. Reload before saving.");
      } else await tx.pluginSetting.create({ data: { organizationId: org, pluginKey: AI_POLICY_KEY, enabled: true, config } });
      await tx.aiAccessRevision.create({ data: { organizationId: org, actorId: req.user!.sub, revision: next, documentJson: config } });
      await cancelWorkAfterPolicyChange(tx, org, current.document, document);
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new CreateError(409, "AI access changed in another session. Reload before saving.");
    throw error;
  }
  return { revision: next, document };
}
export function resolvePolicy(document: AccessDocument, key: string, actor: { sub: string; role: string }, grant?: Pick<ChatGptGrant, "id" | "scopes" | "consentJson">, snapshot?: ConsentSnapshot): AccessDecision {
  const reasons: string[] = [], cap = capabilityFor(key), legacy = Object.values(LEGACY_TOOLS).find(item => item.capability === key);
  const orgRule = document.organization[key];
  // The previous tool set retains its exact historical ceiling until a rule is saved.
  const ceiling: AccessRule = orgRule || { mode: legacy ? "automatic" : "blocked" };
  const specific = document.users[actor.sub]?.[key] || document.roles[actor.role]?.[key] || ceiling;
  const constraints: AccessRule[] = [ceiling, specific];
  let mode = rank[ceiling.mode] < rank[specific.mode] ? ceiling.mode : specific.mode;
  if (ceiling.mode === "blocked") reasons.push("Blocked by organization policy.");
  else if (specific.mode === "blocked") reasons.push(document.users[actor.sub]?.[key] ? "Blocked by user exception." : "Blocked by role default.");
  if (grant) {
    const connection = document.connections[grant.id]?.[key];
    if (connection) { constraints.push(connection); if (rank[connection.mode] < rank[mode]) { mode = connection.mode; reasons.push("Restricted by this connection."); } }
    const consent = snapshot || (grant.consentJson as unknown as ConsentSnapshot | null);
    const scopes = grant.scopes.split(" ");
    const consentRule = consent?.version === 1 ? consent.capabilities[key] : legacy && scopes.includes(legacy.scope) ? { mode: "automatic" as const } : undefined;
    if (!consentRule || !cap || !oauthScopesFor(cap).some(scope => scopes.includes(scope))) { mode = "blocked"; reasons.push("This connection needs renewed consent for this capability."); }
    else {
      constraints.push(consentRule, ...(consent?.constraints[key] || []));
      if (rank[consentRule.mode] < rank[mode]) { mode = consentRule.mode; reasons.push("Limited to the access approved when this account was connected. Reconnect to increase it."); }
    }
  }
  if (!cap) { mode = "blocked"; reasons.push("Unknown capability."); }
  const limits = { ...document.limits };
  const consent = snapshot || (grant?.consentJson as unknown as ConsentSnapshot | null);
  if (consent?.version === 1) for (const name of Object.keys(limits) as (keyof AccessLimits)[]) limits[name] = Math.min(limits[name], consent.limits[name]);
  return { capability: key, mode, reasons, constraints, limits };
}
export async function decideAccess(req: Request, key: string, grant?: Pick<ChatGptGrant, "id" | "scopes" | "consentJson">, supplied?: Awaited<ReturnType<typeof accessPolicy>>): Promise<AccessDecision> {
  if (!req.user) throw new CreateError(401, "Sign in to inspect AI access.");
  const policy = supplied || await policyForRequest(req), decision = resolvePolicy(policy.document, key, req.user, grant);
  let mcpValue = requestMcp.get(req); if (!mcpValue) { mcpValue = readMcpPolicy(req.user.orgId); requestMcp.set(req, mcpValue); }
  const legacy = Object.values(LEGACY_TOOLS).find(item => item.capability === key), mcp = (await mcpValue).policy;
  if (!mcp.enabled || process.env.CHATGPT_FORCE_DISABLED === "true") { decision.mode = "blocked"; decision.reasons.push("MCP access is paused."); }
  if (legacy && (legacy.scope === "letters.read" && !mcp.allowLetterRead || legacy.scope === "letters.write" && !mcp.allowLetterDrafts || legacy.scope === "reports.read" && !mcp.allowReports || key === "images.generate" && !mcp.allowImageGeneration)) { decision.mode = "blocked"; decision.reasons.push("Disabled by existing MCP controls."); }
  for (const permission of capabilityFor(key)?.permissions || []) if (!await currentPermission(req, permission)) { decision.mode = "blocked"; decision.reasons.push(`CRM permission required: ${permission}.`); }
  const minimumRole = capabilityFor(key)?.minRole;
  if (minimumRole && (ROLE_HIERARCHY.indexOf(req.user.role as typeof ROLE_HIERARCHY[number]) < 0 || ROLE_HIERARCHY.indexOf(req.user.role as typeof ROLE_HIERARCHY[number]) > ROLE_HIERARCHY.indexOf(minimumRole))) { decision.mode = "blocked"; decision.reasons.push(`The native CRM command requires the ${minimumRole} role or above.`); }
  return decision;
}
export async function demandAccess(req: Request, key: string, grant: Pick<ChatGptGrant, "id" | "scopes" | "consentJson">) {
  const decision = await decideAccess(req, key, grant);
  if (decision.mode === "blocked") throw new CreateError(403, `${key}: ${decision.reasons.join(" ")}`);
  return decision;
}
export async function consentSnapshot(req: Request, scopes: string[]): Promise<ConsentSnapshot> {
  const policy = await accessPolicy(req.user!.orgId), capabilities: RuleSet = {}, constraints: Record<string, AccessRule[]> = {};
  let customFields: string[] | undefined;
  for (const cap of CAPABILITIES) {
    const legacy = Object.values(LEGACY_TOOLS).find(item => item.capability === cap.key);
    const requested = oauthScopesFor(cap).filter(scope => scopes.includes(scope));
    if (!requested.length) continue;
    const decision = legacy ? resolvePolicy(policy.document, cap.key, req.user!) : await decideAccess(req, cap.key, undefined, policy);
    if (legacy) for (const permission of cap.permissions) if (!await currentPermission(req, permission)) decision.mode = "blocked";
    if (decision.mode === "blocked") { if (!legacy && requested.includes(cap.key) && cap.key !== "letters.read") throw new CreateError(403, `${cap.title}: ${decision.reasons.join(" ")}`); continue; }
    const res = cap.resource ? resourceFor(cap.resource) : undefined;
    const isCustom = res && ["custom_fields", "custom_values"].includes(res.key) && cap.key !== "custom_fields.create";
    if (isCustom && !customFields) customFields = (await prisma.customField.findMany({ where: { organizationId: req.user!.orgId, active: true, entityType: { in: ["constituent", "donation", "campaign", "event"] } }, select: { id: true }, orderBy: { id: "asc" }, take: 1000 })).map(field => field.id);
    const customFieldIds = isCustom ? customFields : undefined;
    capabilities[cap.key] = { mode: decision.mode, ...(res ? { fields: capabilityFields(cap) } : {}), ...(customFieldIds ? { customFieldIds } : {}) };
    constraints[cap.key] = decision.constraints;
  }
  for (const [scope, read] of [[AI_READ_SCOPE, true], [AI_WRITE_SCOPE, false]] as const) {
    if (scopes.includes(scope) && !CAPABILITIES.some(cap => cap.read === read && oauthScopesFor(cap).includes(scope) && capabilities[cap.key])) throw new CreateError(403, `No ${read ? "read" : "write"} capabilities are enabled for this CRM account. Review Settings → AI access.`);
  }
  return { version: 1, policyRevision: policy.revision, capabilities, constraints, limits: policy.document.limits };
}
export function presetRules(name: string): RuleSet {
  if (!["read", "drafting", "supervised"].includes(name)) throw new CreateError(400, "Choose a supported access preset.");
  const rules: RuleSet = {};
  for (const cap of CAPABILITIES) {
    if (cap.key === "images.generate") continue; // Billed generation always needs an explicit choice.
    const draft = /draft|studio_content\.update|images\.import|notes\.append|tasks\.(create|update)/.test(cap.key);
    if (cap.read || name === "supervised" || name === "drafting" && draft) rules[cap.key] = { mode: cap.read || cap.risk === "routine" ? "automatic" : "approval" };
  }
  return rules;
}
