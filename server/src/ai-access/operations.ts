import { createHash } from "node:crypto";
import type { Request } from "express";
import { Prisma, type AiOperation, type ChatGptGrant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { demand } from "../oyama-create/access.js";
import { CreateError } from "../oyama-create/domain.js";
import { toolFingerprint } from "../chatgpt/receipts.js";
import { effectiveConnectionConfig } from "../chatgpt/setup.js";
import { capabilityFor, resourceFor, modelFields, fieldGroup, type AiCapability } from "./catalog.js";
import type { OperationInput, AccessDecision } from "./contracts.js";
import { demandAccess, decideAccess, accessPolicy } from "./policy.js";
import { actionSchema, validate } from "./validation.js";
import { rawRecord, getRecord, allowedFields, delegateFor, asJson, recordVersion, recordUrl, searchRecords, type DataRow } from "./records.js";
import { invokeNative } from "./native.js";
import { aiMutationContext } from "./mutation-context.js";

type StoredRequest = OperationInput & { legacy?: { name: string; arguments: Record<string, unknown> } };
type Preview = { title: string; changes: { field: string; before: unknown; after: unknown }[]; targets: { resource: string; id: string; version: string }[]; heldEffects: string[]; policyRevision: number; accessFingerprint: string };
type LegacyExecutor = (req: Request, grantId: string, name: string, input: Record<string, unknown>, origin: string) => Promise<unknown>;
let legacyExecutor: LegacyExecutor | undefined;
export function registerLegacyExecutor(executor: LegacyExecutor) { legacyExecutor = executor; }
const activeStatuses = ["PENDING", "QUEUED"];
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const idValue = (input: unknown, name: string): string => { if (typeof input !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(input)) throw new CreateError(400, `Provide a verified ${name}.`); return input; };
export async function currentGrant(id: string, org?: string) {
  const grant = await prisma.chatGptGrant.findFirst({ where: { id, ...(org ? { organizationId: org } : {}), revokedAt: null, refreshExpiresAt: { gt: new Date() } } });
  if (!grant) throw new CreateError(403, "This AI connection is expired or revoked.");
  return grant;
}
async function actorRequest(actorId: string, org: string): Promise<Request> {
  const user = await prisma.user.findFirst({ where: { id: actorId, organizationId: org, active: true, role: { not: "compassion_user" } } });
  if (!user) throw new CreateError(403, "The initiating CRM account is no longer active.");
  return { user: { sub: user.id, orgId: org, role: user.role, email: user.email }, headers: {}, get: () => undefined } as unknown as Request;
}
async function preflight(req: Request, grant: ChatGptGrant, cap: AiCapability, input: StoredRequest): Promise<{ preview: Preview; decision: AccessDecision; rows: Map<string, DataRow> }> {
  const decision = await demandAccess(req, cap.key, grant), policy = await accessPolicy(req.user!.orgId), rows = new Map<string, DataRow>();
  const preview: Preview = { title: cap.title, changes: [], targets: [], heldEffects: [], policyRevision: policy.revision, accessFingerprint: fingerprint([policy.document, grant.consentJson]) };
  if (input.legacy) {
    preview.changes = [{ field: "draft", before: null, after: "Save the supplied draft content in Studio; no release or delivery." }];
    if (typeof input.legacy.arguments.id === "string" && cap.key === "letters.draft.update") {
      const content = await prisma.createContent.findFirst({ where: { id: input.legacy.arguments.id, organizationId: req.user!.orgId } });
      if (!content || input.legacy.arguments.revision !== content.revision) throw new CreateError(409, "The Studio draft changed. Read its current revision.");
      preview.targets.push({ resource: "studio_draft", id: content.id, version: String(content.revision) });
    }
    return { preview, decision, rows };
  }
  validate(actionSchema(cap), input);
  if (JSON.stringify(input).length > 250000) throw new CreateError(413, "This command is too large.");
  const fields = input.fields || {}, res = cap.resource ? resourceFor(cap.resource) : undefined;
  if (res) {
    await demandAccess(req, `${res.key}.read`, grant);
    const readable = await allowedFields(req, res, grant);
    for (const key of Object.keys(fields)) {
      if (modelFields(res).some(field => field.name === key) && !readable.has(key)) throw new CreateError(403, `Read access to ${res.key}.${key} is required before changing it.`);
      if (decision.constraints.some(rule => rule.fields && !rule.fields.includes(key))) throw new CreateError(403, `This connection cannot write ${res.key}.${key}.`);
    }
    if (input.id) {
      const row = await rawRecord(req, res, idValue(input.id, "record ID"), grant, true, decision.constraints);
      if (!input.expectedVersion || input.expectedVersion !== recordVersion(row)) throw new CreateError(409, "The record changed or its version is missing. Fetch the record before preparing this command.");
      rows.set(`${res.key}:${input.id}`, row);
      preview.targets.push({ resource: res.key, id: input.id, version: recordVersion(row) });
    } else if (cap.native?.path.includes(":id") || cap.key.endsWith(".update") || cap.key.endsWith(".delete") || cap.handler === "note") throw new CreateError(400, "The target record ID and expectedVersion are required.");
    for (const rule of decision.constraints) if (!input.id) {
      if (rule.records === "own" && res.owner && fields[res.owner] && fields[res.owner] !== req.user!.sub) throw new CreateError(403, "This action can create only records assigned to you.");
      if (rule.records === "selected") {
        const matchesCampaign = res.campaign && rule.campaignIds?.includes(String(fields[res.campaign] || ""));
        const matchesEvent = res.event && rule.eventIds?.includes(String(input.eventId || fields[res.event] || ""));
        if (!matchesCampaign && !matchesEvent) throw new CreateError(403, "Choose a permitted campaign or event.");
      }
    }
    const before = input.id ? rows.get(`${res.key}:${input.id}`) : undefined;
    for (const [field, after] of Object.entries(fields)) preview.changes.push({ field, before: before?.[field] ?? null, after });
  }
  const references: Record<string, string> = { constituentId: "constituents", campaignId: "campaigns", fundraisingCampaignId: "campaigns", eventId: "events", grantId: "grants", funderId: "funders", designationId: "funds", pledgeId: "pledges", assigneeId: "staff", assignedStaffId: "staff", ownerUserId: "staff", pathId: "paths", keepId: "constituents", mergeId: "constituents" };
  for (const [field, resource] of Object.entries(references)) {
    const value = fields[field] || (["eventId", "grantId", "pathId"].includes(field) ? input[field as keyof OperationInput] : undefined);
    if (!value) continue;
    const linkedRes = resourceFor(resource)!;
    const row = await rawRecord(req, linkedRes, idValue(value, field), grant);
    rows.set(`${resource}:${String(value)}`, row);
    preview.targets.push({ resource, id: String(value), version: recordVersion(row) });
  }
  if (cap.key === "constituents.merge" && fields.keepId === fields.mergeId) throw new CreateError(400, "Choose different constituents to merge.");
  if (cap.key === "gifts.create" || cap.key === "gifts.update" || cap.key === "constituents.create") preview.heldEffects.push("Automatic Steward Path triggers and accounting exports are held. Request those actions separately in CRM.");
  if (cap.key === "email.send") {
    if (fields.sendMode !== "LIST" || !Array.isArray(fields.recipientEmails) || !fields.recipientEmails.length || fields.recipientEmails.length > decision.limits.maxRecipients) throw new CreateError(400, `Provide an explicit LIST of at most ${decision.limits.maxRecipients} verified recipient emails.`);
    const people = resourceFor("constituents")!;
    await demandAccess(req, "constituents.contact.read", grant);
    for (const email of [...new Set(fields.recipientEmails)]) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CreateError(400, "Provide valid recipient email addresses.");
      const found = await searchRecords(req, grant, { resource: "constituents", query: email, limit: 25 }, "");
      if (!found.items.some(item => String(item.fields.email || "").toLowerCase() === email.toLowerCase())) throw new CreateError(403, "Each recipient must resolve to an accessible active CRM constituent.");
    }
    const row = rows.get(`email:${input.id}`);
    if (!row) throw new CreateError(400, "Choose an email campaign.");
    if (!["DRAFT", "SCHEDULED"].includes(String(row.status))) throw new CreateError(409, "This campaign is no longer an editable unsent draft.");
    void people;
  }
  return { preview, decision, rows };
}
export async function submitOperation(req: Request, grant: ChatGptGrant, capability: string, input: StoredRequest, origin: string) {
  const cap = capabilityFor(capability);
  if (!cap || cap.read) throw new CreateError(400, "Choose a supported AI write action.");
  await demandAccess(req, cap.key, grant);
  const requestKey = input.requestKey;
  if (typeof requestKey !== "string" || requestKey.length < 8 || requestKey.length > 100) throw new CreateError(400, "Provide a stable requestKey between 8 and 100 characters.");
  const hash = toolFingerprint([cap.key, { ...input, preview: undefined }]);
  const existing = await prisma.aiOperation.findUnique({ where: { organizationId_actorId_requestKey: { organizationId: req.user!.orgId, actorId: req.user!.sub, requestKey } } });
  if (existing) {
    if (existing.fingerprint !== hash) throw new CreateError(409, "This requestKey already describes a different command.");
    return operationResult(req, grant, existing, origin, !!input.legacy);
  }
  const { preview, decision } = await preflight(req, grant, cap, input);
  if (input.preview) return { status: "PREVIEW", capability, mode: decision.mode, preview, reviewRequired: decision.mode === "approval" };
  let saved: AiOperation;
  try {
    saved = await prisma.aiOperation.create({ data: { organizationId: req.user!.orgId, actorId: req.user!.sub, grantId: grant.id, capability, requestKey, fingerprint: hash, payloadJson: asJson(input), previewJson: asJson(preview), status: decision.mode === "approval" ? "PENDING" : "QUEUED", expiresAt: new Date(Date.now() + 86400000) } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const concurrent = await prisma.aiOperation.findUnique({ where: { organizationId_actorId_requestKey: { organizationId: req.user!.orgId, actorId: req.user!.sub, requestKey } } });
    if (!concurrent || concurrent.fingerprint !== hash) throw new CreateError(409, "This requestKey already describes a different command.");
    return operationResult(req, grant, concurrent, origin, !!input.legacy);
  }
  await logAudit({ action: "AI_OPERATION_REQUESTED", userId: req.user!.sub, organizationId: req.user!.orgId, entity: "AiOperation", entityId: saved.id, metadata: { capability, status: saved.status, fields: Object.keys(input.fields || {}) } });
  // Existing callers keep their immediate draft-save contract. External writes use
  // the durable worker so an HTTP disconnect cannot cause an automatic resubmission.
  if (saved.status === "QUEUED" && (input.legacy || cap.risk === "routine")) { await executeOperation(saved.id, origin); saved = (await prisma.aiOperation.findUnique({ where: { id: saved.id } }))!; }
  return operationResult(req, grant, saved, origin, !!input.legacy);
}
export async function operationResult(req: Request, grant: ChatGptGrant, operation: AiOperation, origin: string, legacy = false) {
  if (operation.organizationId !== req.user!.orgId || operation.actorId !== req.user!.sub || operation.grantId !== grant.id && operation.actorId !== grant.userId) throw new CreateError(404, "AI operation not found.");
  await demandAccess(req, operation.capability, grant);
  const result = operation.resultJson as Record<string, unknown> | null;
  if (legacy && operation.status === "SUCCEEDED") return result;
  return { operationId: operation.id, capability: operation.capability, status: operation.status, ...(operation.status === "SUCCEEDED" ? { result } : {}), ...(operation.status === "FAILED" || operation.status === "INTERRUPTED" || operation.status === "STALE" ? { message: operation.reviewReason } : {}), reviewRequired: operation.status === "PENDING", expiresAt: operation.expiresAt, url: `${origin}/settings/ai-access?tab=${operation.status === "PENDING" ? "approvals" : "activity"}&operation=${operation.id}`, retryAfterSeconds: operation.status === "QUEUED" || operation.status === "RUNNING" ? 3 : undefined };
}
async function directAction(req: Request, grant: ChatGptGrant, cap: AiCapability, input: StoredRequest, before: DataRow | undefined) {
  const fields = input.fields || {}, res = resourceFor(cap.resource!)!, org = req.user!.orgId;
  if (cap.handler === "note") {
    await demandAccess(req, "constituents.notes.read", grant);
    const note = String(fields.note).trim();
    if (!note) throw new CreateError(400, "Provide a note to append.");
    return prisma.$transaction(async tx => {
      const result = await tx.constituent.updateMany({ where: { id: input.id, organizationId: org, updatedAt: before!.updatedAt as Date }, data: { notes: [before!.notes, note].filter(Boolean).join("\n\n") } });
      if (result.count !== 1) throw new CreateError(409, "The constituent changed. Prepare the note again.");
      await tx.activity.create({ data: { constituentId: input.id!, userId: req.user!.sub, type: "NOTE", description: note } });
      return { id: input.id };
    });
  }
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const model = modelFields(res).find(field => field.name === key);
    if (!model) continue;
    if (model.type === "DateTime" && value !== null) {
      const parsed = new Date(String(value));
      if (!Number.isFinite(parsed.getTime())) throw new CreateError(400, `Use a valid date for ${key}.`);
      data[key] = parsed;
    } else data[key] = value;
  }
  if (cap.handler === "fund" && (!before || data.name !== undefined) && !String(data.name || "").trim()) throw new CreateError(400, "A fund name is required.");
  if (cap.handler === "pledge") {
    const total = Number(data.totalAmount ?? before?.totalAmount);
    if (!Number.isFinite(total) || total <= 0 || !before && (!data.constituentId || !data.startDate)) throw new CreateError(400, "A pledge needs a constituent, positive totalAmount and startDate.");
    if (total < Number(before?.paidAmount || 0)) throw new CreateError(400, "The pledge total cannot be less than its recorded payments.");
  }
  if (cap.handler === "volunteer" && (!before && (!data.constituentId || !data.date) || data.hours !== undefined && (Number(data.hours) <= 0 || Number(data.hours) > 24))) throw new CreateError(400, "Volunteer time needs a constituent, date and between 0 and 24 hours.");
  if (cap.handler === "custom") {
    const definition = await prisma.customField.findFirst({ where: { id: String(fields.fieldId), organizationId: org, entityType: String(fields.entityType), active: true } });
    const target = { constituent: "constituents", donation: "gifts", campaign: "campaigns", event: "events" }[String(fields.entityType)];
    if (!definition || !target) throw new CreateError(404, "Custom field not found.");
    await rawRecord(req, resourceFor(target)!, String(fields.entityId), grant, true);
    const result = await prisma.customFieldValue.upsert({ where: { fieldId_entityId: { fieldId: definition.id, entityId: String(fields.entityId) } }, create: { fieldId: definition.id, entityId: String(fields.entityId), entityType: String(fields.entityType), value: JSON.stringify(fields.value ?? null) }, update: { value: JSON.stringify(fields.value ?? null) } });
    return { id: result.id };
  }
  const delegate = delegateFor(res);
  if (input.id) {
    const changed = await delegate.updateMany({ where: { id: input.id, ...(before?.updatedAt ? { updatedAt: before.updatedAt } : before), ...(["fund"].includes(cap.handler || "") ? { organizationId: org } : {}) }, data });
    if (changed.count !== 1) throw new CreateError(409, "This record changed before it could be saved.");
    return { id: input.id };
  }
  if (res.scope === "organization") data.organizationId = org;
  return delegate.create({ data });
}
function resultId(value: Record<string, unknown>, fallback?: string): string | undefined {
  if (typeof value.id === "string") return value.id;
  for (const key of ["data", "campaign", "constituent", "donation", "guest", "table", "grant", "meeting", "task", "enrollment", "page", "site"]) {
    const nested = value[key]; if (nested && typeof nested === "object" && "id" in nested && typeof nested.id === "string") return nested.id;
  }
  return fallback;
}
export async function executeOperation(id: string, origin: string) {
  const existing = await prisma.aiOperation.findUnique({ where: { id } });
  if (!existing || existing.status !== "QUEUED") return;
  const claimed = await prisma.aiOperation.updateMany({ where: { id, status: "QUEUED" }, data: { status: "RUNNING", claimedAt: new Date() } });
  if (!claimed.count) return;
  let executed = false;
  try {
    const grant = await currentGrant(existing.grantId, existing.organizationId), req = await actorRequest(existing.actorId, existing.organizationId);
    if (!(await effectiveConnectionConfig(req, existing.organizationId)).enabled) throw new CreateError(403, "ChatGPT access is disabled for this installation.");
    const cap = capabilityFor(existing.capability)!, input = existing.payloadJson as unknown as StoredRequest;
    const { preview, decision, rows } = await preflight(req, grant, cap, input), approved = existing.previewJson as unknown as Preview;
    if (decision.mode === "approval" && !existing.reviewedAt) throw new CreateError(403, "This command now needs CRM approval.");
    if (existing.reviewedAt && !existing.reviewerId) throw new CreateError(403, "The approval reviewer is unavailable.");
    if (existing.reviewerId) {
      const reviewer = await actorRequest(existing.reviewerId, existing.organizationId);
      for (const permission of cap.permissions) await demand(reviewer, permission);
    }
    if (JSON.stringify(preview.targets) !== JSON.stringify(approved.targets)) throw new CreateError(409, "Records changed after this command was prepared. Prepare a new command and approval.");
    if (existing.expiresAt <= new Date()) throw new CreateError(409, "This command expired. Prepare a new command.");
    const guards = [...rows.entries()].map(([key, row]) => ({ model: resourceFor(key.split(":")[0])!.model, id: String(row.id), expected: row }));
    const result = await aiMutationContext.run({ operationId: id, guards, suppressImplicitEffects: true }, async () => {
      executed = true;
      if (input.legacy) {
        if (!legacyExecutor) throw new CreateError(503, "The Studio command adapter is unavailable.");
        return legacyExecutor(req, grant.id, input.legacy.name, input.legacy.arguments, origin);
      }
      const res = cap.resource ? resourceFor(cap.resource) : undefined;
      const before = res && input.id ? rows.get(`${res.key}:${input.id}`) : undefined;
      let output: Record<string, unknown>;
      if (cap.handler === "export") {
        const fields = input.fields || {}, target = resourceFor(String(fields.resource));
        if (!target) throw new CreateError(400, "Choose an exportable resource.");
        let cursor: string | undefined; const items = [];
        do {
          const page = await searchRecords(req, grant, { resource: target.key, query: String(fields.query || ""), cursor, limit: Math.min(decision.limits.maxRows, decision.limits.maxExport - items.length) }, origin);
          items.push(...page.items); cursor = page.nextCursor || undefined;
        } while (cursor && items.length < decision.limits.maxExport);
        return { export: { resource: target.key, items, truncated: !!cursor, policyFingerprint: preview.accessFingerprint }, downloadUrl: `${origin}/api/chatgpt/operations/${id}/export`, count: items.length };
      }
      if (cap.native) {
        const parameters: Record<string, string> = {};
        for (const key of ["id", "eventId", "grantId", "pathId", "key"] as const) if (input[key] || before?.[key]) parameters[key] = String(input[key] || before?.[key]);
        const body = { ...(cap.native.method === "PUT" && before ? Object.fromEntries((cap.fields || []).filter(key => before[key] !== undefined).map(key => [key, before[key]])) : {}), ...input.fields };
        output = await invokeNative(req, cap, parameters, body);
      } else output = await directAction(req, grant, cap, input, before);
      const savedId = resultId(output, input.id);
      return { resource: res?.key, id: savedId ? `${res?.key}:${savedId}` : undefined, url: res && savedId ? recordUrl(res, { ...before, ...input.fields, id: savedId }, origin) : `${origin}/settings/ai-access?tab=activity&operation=${id}`, heldEffects: preview.heldEffects, changedFields: Object.keys(input.fields || {}) };
    });
    await prisma.aiOperation.updateMany({ where: { id, status: "RUNNING" }, data: { status: "SUCCEEDED", resultJson: asJson(result), finishedAt: new Date() } });
    await logAudit({ action: "AI_OPERATION_SUCCEEDED", userId: existing.actorId, organizationId: existing.organizationId, entity: "AiOperation", entityId: id, metadata: { capability: existing.capability } });
  } catch (error) {
    const known = error instanceof CreateError;
    const status = known && error.status === 409 ? "STALE" : executed && (!known || error.status >= 500) ? "INTERRUPTED" : "FAILED";
    await prisma.aiOperation.updateMany({ where: { id, status: "RUNNING" }, data: { status, reviewReason: known ? error.message.slice(0, 500) : "The CRM command failed. Review its records before submitting a new request; this operation will not be retried automatically.", finishedAt: new Date() } });
    await logAudit({ action: "AI_OPERATION_FAILED", userId: existing.actorId, organizationId: existing.organizationId, entity: "AiOperation", entityId: id, metadata: { capability: existing.capability, status } });
  }
}
export async function reviewOperation(req: Request, id: string, approve: boolean, reason?: string) {
  const row = await prisma.aiOperation.findFirst({ where: { id, organizationId: req.user!.orgId, status: "PENDING" } });
  if (!row) throw new CreateError(404, "Pending AI approval not found.");
  const cap = capabilityFor(row.capability)!;
  if (!["admin", "manager"].includes(req.user!.role) && row.actorId !== req.user!.sub) throw new CreateError(403, "Review your own requests or ask an administrator or manager.");
  for (const permission of cap.permissions) await demand(req, permission);
  if (row.expiresAt <= new Date()) throw new CreateError(409, "This approval expired. Prepare a new command.");
  const grant = await currentGrant(row.grantId, row.organizationId), actor = await actorRequest(row.actorId, row.organizationId);
  if (approve) {
    const { preview } = await preflight(actor, grant, cap, row.payloadJson as unknown as StoredRequest);
    if (JSON.stringify(preview.targets) !== JSON.stringify((row.previewJson as unknown as Preview).targets)) throw new CreateError(409, "Records changed. Prepare a new request before approving.");
    // Reviewers must be able to inspect the same affected records, not only the module.
    for (const target of preview.targets) if (target.resource !== "studio_draft") {
      const res = resourceFor(target.resource)!;
      const actorRow = await rawRecord(actor, res, target.id, grant);
      if (req.user!.sub !== actor.user!.sub && req.user!.role !== "admin" && ["tasks", "meetings", "documents"].includes(res.key) && actorRow[res.owner || ""] !== req.user!.sub) throw new CreateError(403, "This record is private to the requesting staff member.");
      await demand(req, res.permission);
    }
  }
  const changed = await prisma.aiOperation.updateMany({ where: { id, status: "PENDING", updatedAt: row.updatedAt }, data: { status: approve ? "QUEUED" : "REJECTED", reviewerId: req.user!.sub, reviewedAt: new Date(), reviewReason: reason?.slice(0, 500) || null } });
  if (!changed.count) throw new CreateError(409, "This approval was already handled.");
  await logAudit({ action: approve ? "AI_OPERATION_APPROVED" : "AI_OPERATION_REJECTED", userId: req.user!.sub, organizationId: req.user!.orgId, entity: "AiOperation", entityId: id, metadata: { capability: row.capability } });
  return { id, status: approve ? "QUEUED" : "REJECTED" };
}
export async function cancelOperation(req: Request, id: string) {
  const result = await prisma.aiOperation.updateMany({ where: { id, organizationId: req.user!.orgId, ...(req.user!.role === "admin" ? {} : { actorId: req.user!.sub }), status: { in: activeStatuses } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  if (!result.count) throw new CreateError(409, "This operation is unavailable or has already started.");
  return { id, status: "CANCELLED" };
}
export async function processAiOperations(origin: string) {
  const now = new Date();
  await prisma.aiOperation.updateMany({ where: { status: { in: activeStatuses }, expiresAt: { lte: now } }, data: { status: "EXPIRED", finishedAt: now } });
  await prisma.aiOperation.updateMany({ where: { status: "RUNNING", claimedAt: { lt: new Date(now.getTime() - 10 * 60000) } }, data: { status: "INTERRUPTED", finishedAt: now, reviewReason: "The worker stopped during execution. Review the CRM records before preparing another request. This operation was not automatically repeated." } });
  const pending = await prisma.aiOperation.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 10, select: { id: true } });
  for (const row of pending) await executeOperation(row.id, origin);
}
let timer: ReturnType<typeof setInterval> | undefined, running = false;
export function startAiOperationWorker(origin: string) {
  if (timer) return;
  timer = setInterval(() => { if (running) return; running = true; void processAiOperations(origin).catch(() => console.error("[AI access] Operation worker unavailable; check migrations and database health.")).finally(() => { running = false; }); }, 3000);
  timer.unref();
}
export function stopAiOperationWorker() { if (timer) clearInterval(timer); timer = undefined; }
