import type { Request } from "express";
import { Prisma, type AiOperation, type ChatGptGrant } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { demand } from "../oyama-create/access.js";
import { ROLE_HIERARCHY } from "../middleware/requireRole.js";
import { CreateError } from "../oyama-create/domain.js";
import { toolFingerprint } from "../chatgpt/receipts.js";
import { effectiveConnectionConfig } from "../chatgpt/setup.js";
import { getLetterImageJob } from "../chatgpt/letter-images.js";
import { contentFor } from "../oyama-create/content.js";
import { isTrashed } from "../oyama-create/trash-state.js";
import { getWebmasterPageById, getWebmasterSiteById, listWebmasterPages, type WebmasterSiteRecord } from "../services/webmaster-store.js";
import { buildWebmasterPublishReadinessReport } from "../services/webmaster-publish-readiness.js";
import { capabilityFor, resourceFor, modelFields, type AiCapability } from "./catalog.js";
import { pendingOperationStatuses, type OperationInput, type AccessDecision } from "./contracts.js";
import { demandAccess, accessPolicy } from "./policy.js";
import { actionSchema, validate, validateCustomValue } from "./validation.js";
import { rawRecord, allowedFields, delegateFor, asJson, recordVersion, recordUrl, searchRecords, nativeRowAccessible, tenantWhere, type DataRow } from "./records.js";
import { invokeNative } from "./native.js";
import { aiMutationContext } from "./mutation-context.js";
import { validateCampaignSendReadiness } from "../routes/email-campaigns.js";

type StoredRequest = OperationInput & { legacy?: { name: string; arguments: Record<string, unknown> } };
type Preview = { title: string; changes: { field: string; before: unknown; after: unknown }[]; targets: { resource: string; id: string; version: string }[]; heldEffects: string[]; policyRevision: number; accessFingerprint: string; children?: { capability: string; preview: Preview }[]; export?: { resource: string; items: { id: string; version: string; fields: string[] }[]; truncated: boolean } };
type LegacyExecutor = (req: Request, grantId: string, name: string, input: Record<string, unknown>, origin: string) => Promise<unknown>;
type EmailDeliveryReview = NonNullable<Awaited<ReturnType<typeof validateCampaignSendReadiness>>["deliveryReview"]>;
const deliveryReviewField = "delivery content and eligible recipients";
let legacyExecutor: LegacyExecutor | undefined;
export function registerLegacyExecutor(executor: LegacyExecutor) { legacyExecutor = executor; }
const idValue = (input: unknown, name: string): string => { if (typeof input !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(input)) throw new CreateError(400, `Provide a verified ${name}.`); return input; };
function preservedSourceIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(preservedSourceIds);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => key === "sourceRevisionId" && typeof child === "string" ? [child] : preservedSourceIds(child));
}
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
  const preview: Preview = { title: cap.title, changes: [], targets: [], heldEffects: [], policyRevision: policy.revision, accessFingerprint: toolFingerprint([policy.document, grant.consentJson]) };
  if (input.legacy) {
    const args = input.legacy.arguments;
    preview.changes = Object.entries(args).filter(([key]) => !["requestKey", "file"].includes(key)).map(([field, after]) => ({ field, before: null, after }));
    if (input.legacy.name === "import_letter_image") preview.changes.push({ field: "image", before: null, after: "Copy the selected ChatGPT attachment to the Studio image library." });
    if (typeof input.legacy.arguments.id === "string" && cap.key === "letters.draft.update") {
      const { content, campaign } = await contentFor(req, input.legacy.arguments.id, true);
      if (campaign.ownerId !== req.user!.sub || await isTrashed(req.user!.orgId, "CONTENT", content.id) || await isTrashed(req.user!.orgId, "CAMPAIGN", campaign.id)) throw new CreateError(404, "The Studio draft is unavailable to this connection.");
      if (input.legacy.arguments.revision !== content.revision) throw new CreateError(409, "The Studio draft changed. Read its current revision.");
      preview.targets.push({ resource: "studio_draft", id: content.id, version: String(content.revision) });
    }
    return { preview, decision, rows };
  }
  validate(actionSchema(cap), input);
  if (JSON.stringify(input).length > 250000) throw new CreateError(413, "This command is too large.");
  const fields = input.fields || {}, res = cap.resource ? resourceFor(cap.resource) : undefined;
  if (cap.handler === "import") {
    await demandAccess(req, "constituents.create", grant);
    const records = fields.records as DataRow[] | undefined;
    if (!records?.length || records.length > decision.limits.maxBatch) throw new CreateError(400, `Provide 1–${decision.limits.maxBatch} constituent records.`);
    const create = capabilityFor("constituents.create")!;
    for (const [index, row] of records.entries()) {
      if (!String(row.firstName).trim() || !String(row.lastName).trim()) throw new CreateError(400, `Row ${index + 1} needs a first and last name.`);
      const checked = await preflight(req, grant, create, { fields: row, requestKey: input.requestKey });
      if (checked.decision.mode === "approval") decision.mode = "approval";
    }
    const result = await invokeNative(req, importAdapter, {}, { ...importInput(records), dryRun: true });
    preview.changes = [{ field: "import summary", before: null, after: importSummary(result) }, { field: "input rows", before: null, after: records }];
    preview.heldEffects.push("Existing records are skipped. Imports cannot trigger sends, accounting sync, or automatic enrollment.");
    return { preview, decision, rows };
  }
  if (cap.handler === "batch") {
    const children = batchInputs(input, decision.limits.maxBatch);
    preview.children = [];
    const affected = new Set<string>();
    for (const child of children) {
      const checked = await preflight(req, grant, child.cap, child.input);
      if (checked.decision.mode === "approval") decision.mode = "approval";
      if (child.input.id) {
        const target = `${child.cap.resource}:${child.input.id}`;
        if (affected.has(target)) throw new CreateError(400, "Group edits to the same record into one batch item.");
        affected.add(target);
      }
      preview.children.push({ capability: child.cap.key, preview: checked.preview });
      preview.targets.push(...checked.preview.targets);
    }
    preview.changes = [{ field: "batch", before: null, after: preview.children.map(child => ({ action: child.preview.title, changes: child.preview.changes })) }];
    return { preview, decision, rows };
  }
  if (cap.handler === "export") {
    const target = resourceFor(String(fields.resource));
    if (!target) throw new CreateError(400, "Choose an exportable resource.");
    await demandAccess(req, `${target.key}.read`, grant);
    let cursor: string | undefined;
    let scannedPages = 0;
    const items: NonNullable<Preview["export"]>["items"] = [];
    do {
      const page = await searchRecords(req, grant, { resource: target.key, query: String(fields.query || ""), cursor, limit: Math.min(decision.limits.maxRows, decision.limits.maxExport - items.length) }, "");
      items.push(...page.items.map(({ id, version, fields }) => ({ id, version, fields: Object.keys(fields) })));
      cursor = page.nextCursor || undefined;
    } while (cursor && items.length < decision.limits.maxExport && ++scannedPages < 200);
    preview.export = { resource: target.key, items, truncated: !!cursor };
    preview.changes = [{ field: "export", before: null, after: { resource: target.title, search: fields.query || "", count: items.length, fields: [...new Set(items.flatMap(item => item.fields))], truncated: !!cursor } }];
  }
  if (cap.handler === "custom") {
    const fieldId = idValue(fields.fieldId, "custom field ID"), entityId = idValue(fields.entityId, "record ID");
    const entity = { constituent: "constituents", donation: "gifts", campaign: "campaigns", event: "events" }[String(fields.entityType)];
    if (!entity) throw new CreateError(400, "Choose a supported custom field record type.");
    const definition = await rawRecord(req, resourceFor("custom_fields")!, fieldId, grant);
    if (!definition.active || definition.entityType !== fields.entityType || decision.constraints.some(rule => rule.customFieldIds && !rule.customFieldIds.includes(fieldId))) throw new CreateError(403, "This connection cannot write that custom field.");
    validateCustomValue({ fieldType: definition.fieldType, options: definition.options, required: definition.required }, fields.value);
    if (decision.constraints.some(rule => rule.fields && !rule.fields.includes("value"))) throw new CreateError(403, "This connection cannot change the custom field value.");
    const parent = await rawRecord(req, resourceFor(entity)!, entityId, grant, true);
    const current = await prisma.customFieldValue.findFirst({ where: { fieldId, entityId, entityType: String(fields.entityType) }, select: { id: true } });
    const previous = current ? await rawRecord(req, resourceFor("custom_values")!, current.id, grant) : null;
    if (input.expectedVersion !== recordVersion(previous || parent)) throw new CreateError(409, "Fetch the current custom field value, or its parent record before creating it.");
    await demand(req, resourceFor(entity)!.permission);
    if (entity !== "constituents") await demand(req, entity === "gifts" ? "edit:donations" : entity === "campaigns" ? "edit:campaigns" : "edit:events");
    rows.set(`${entity}:${entityId}`, parent);
    rows.set(`custom_fields:${fieldId}`, definition);
    if (previous) rows.set(`custom_values:${String(previous.id)}`, previous);
    preview.targets = [...rows].map(([key, row]) => ({ resource: key.split(":")[0], id: String(row.id), version: recordVersion(row) }));
    preview.changes = [{ field: String(definition.name), before: previous?.value || null, after: fields.value ?? null }];
    return { preview, decision, rows };
  }
  if (res) {
    await demandAccess(req, `${res.key}.read`, grant);
    const row = input.id ? await rawRecord(req, res, idValue(input.id, "record ID"), grant, true, decision.constraints) : undefined;
    if (cap.key === "email.draft.update" && row?.status !== "DRAFT") throw new CreateError(409, "Choose a current email draft. Scheduled or sent campaigns are handled separately.");
    const projected: DataRow = { ...row, ...fields, ...cap.fixedFields, ...(input.eventId ? { eventId: input.eventId } : {}) };
    if (!row && res.owner && projected[res.owner] === undefined) projected[res.owner] = req.user!.sub;
    const readable = await allowedFields(req, res, grant, undefined, !row && cap.key === "custom_fields.create" ? undefined : row || projected);
    for (const key of Object.keys({ ...fields, ...cap.fixedFields })) {
      const controlled = key === "note" ? "notes" : key;
      if (modelFields(res).some(field => field.name === controlled) && !readable.has(controlled)) throw new CreateError(403, `Read access to ${res.key}.${controlled} is required before changing it.`);
      if (decision.constraints.some(rule => rule.fields && !rule.fields.includes(controlled))) throw new CreateError(403, `This connection cannot write ${res.key}.${key}.`);
    }
    if (input.id && row) {
      if (!input.expectedVersion || input.expectedVersion !== recordVersion(row)) throw new CreateError(409, "The record changed or its version is missing. Fetch the record before preparing this command.");
      rows.set(`${res.key}:${input.id}`, row);
      preview.targets.push({ resource: res.key, id: input.id, version: recordVersion(row) });
    } else if (cap.native?.path.includes(":id") || cap.key.endsWith(".update") || cap.key.endsWith(".delete") || cap.handler === "note" || cap.key === "letters.prepare_pdf") throw new CreateError(400, "The target record ID and expectedVersion are required.");
    for (const rule of decision.constraints) {
      if (rule.records === "own" && res.owner && projected[res.owner] !== req.user!.sub) throw new CreateError(403, "This action is limited to records assigned to you.");
      if (rule.records === "selected") {
        const matchesCampaign = res.key === "campaigns" ? rule.campaignIds?.includes(String(input.id)) : res.campaign && rule.campaignIds?.includes(String(projected[res.campaign] || ""));
        const matchesEvent = res.key === "events" ? rule.eventIds?.includes(String(input.id)) : res.event && rule.eventIds?.includes(String(projected[res.event] || ""));
        if (!matchesCampaign && !matchesEvent) throw new CreateError(403, "Choose a permitted campaign or event.");
      }
    }
    const before = input.id ? rows.get(`${res.key}:${input.id}`) : undefined;
    for (const [field, after] of Object.entries({ ...fields, ...cap.fixedFields })) preview.changes.push({ field, before: before?.[field] ?? null, after });
    if (before && !preview.changes.length) preview.changes.push({ field: "record action", before: null, after: cap.title });
    if (cap.key === "studio_content.update") {
      if (!before?.designJson) throw new CreateError(409, "Convert this content to Studio in CRM before editing its design.");
      const sources = new Set(preservedSourceIds(before.designJson));
      if (preservedSourceIds(fields.designJson).some(id => !sources.has(id))) throw new CreateError(403, "Import additional preserved sources through CRM before referencing them in this design.");
      const campaign = await rawRecord(req, resourceFor("create_campaigns")!, String(before.campaignId), grant, true);
      if (campaign.status !== "DRAFT") throw new CreateError(409, "Choose a draft Create campaign before editing its Studio design.");
      rows.set(`create_campaigns:${String(campaign.id)}`, campaign);
      preview.targets.push({ resource: "create_campaigns", id: String(campaign.id), version: recordVersion(campaign) });
      preview.heldEffects.push("Save a new Studio draft revision. Release, sending and publishing require separate actions.");
    }
  }
  const references: Record<string, string> = { constituentId: "constituents", primaryConstituentId: "constituents", campaignId: "campaigns", fundraisingCampaignId: "campaigns", eventId: "events", grantId: "grants", funderId: "funders", designationId: "funds", pledgeId: "pledges", assigneeId: "staff", assignedStaffId: "staff", defaultOwnerId: "staff", ownerUserId: "staff", ownerId: "staff", pathId: "paths", siteId: "websites", keepId: "constituents", mergeId: "constituents", guestId: "event_guests", donationId: "gifts" };
  for (const [field, resource] of Object.entries(references)) {
    const value = fields[field] || (["eventId", "grantId", "pathId", "siteId"].includes(field) ? input[field as keyof OperationInput] : undefined);
    if (!value) continue;
    const linkedRes = resourceFor(resource)!;
    const row = await rawRecord(req, linkedRes, idValue(value, field), grant);
    rows.set(`${resource}:${String(value)}`, row);
    preview.targets.push({ resource, id: String(value), version: recordVersion(row) });
  }
  if (Array.isArray(fields.recipientConstituentIds)) {
    if (fields.recipientConstituentIds.length > decision.limits.maxRecipients) throw new CreateError(400, "The audience exceeds this connection's recipient limit.");
    await demandAccess(req, "constituents.contact.read", grant);
    for (const id of fields.recipientConstituentIds) { const row = await rawRecord(req, resourceFor("constituents")!, idValue(id, "constituent ID"), grant); rows.set(`constituents:${String(id)}`, row); preview.targets.push({ resource: "constituents", id: String(id), version: recordVersion(row) }); }
  }
  if (cap.key === "tags.create" || cap.key === "groups.create") {
    const existing = cap.key === "tags.create" ? await prisma.tag.findFirst({ where: { organizationId: req.user!.orgId, name: String(fields.name) } }) : await prisma.constituentGroup.findFirst({ where: { organizationId: req.user!.orgId, name: String(fields.name), groupType: String(fields.groupType).toUpperCase() } });
    if (existing) throw new CreateError(409, "A record with this name already exists. Search for its ID before preparing an update.");
  }
  if (cap.key === "constituents.tags.update" || cap.key === "constituents.groups.update") {
    const target = cap.key === "constituents.tags.update" ? resourceFor("tags")! : resourceFor("groups")!;
    const previous = cap.key === "constituents.tags.update" ? (await prisma.constituentTag.findMany({ where: { constituentId: input.id }, select: { tagId: true } })).map(row => row.tagId) : (await prisma.constituentGroupMember.findMany({ where: { constituentId: input.id }, select: { groupId: true } })).map(row => row.groupId);
    const ids = cap.key === "constituents.tags.update" ? (await prisma.tag.findMany({ where: { organizationId: req.user!.orgId, name: { in: fields.tags as string[] } }, select: { id: true, name: true } })) : (fields.groupMemberships as { groupId: string }[]).map(row => ({ id: row.groupId }));
    if (cap.key === "constituents.tags.update" && new Set((fields.tags as string[]).map(name => name.toLowerCase())).size !== ids.length) throw new CreateError(400, "Create each new tag separately before assigning it.");
    for (const id of new Set([...previous, ...ids.map(row => row.id)])) {
      const linked = await rawRecord(req, target, id, grant);
      rows.set(`${target.key}:${id}`, linked);
      preview.targets.push({ resource: target.key, id, version: recordVersion(linked) });
    }
    preview.changes[0].before = previous;
  }
  if (Array.isArray(fields.items)) for (const item of fields.items as { ticketTypeId: string }[]) {
    const ticket = await rawRecord(req, resourceFor("ticket_types")!, item.ticketTypeId, grant);
    if (ticket.eventId !== input.eventId) throw new CreateError(400, "Each ticket type must belong to the selected event.");
    preview.targets.push({ resource: "ticket_types", id: item.ticketTypeId, version: recordVersion(ticket) });
  }
  if (cap.native) for (const key of cap.native.path.match(/:[A-Za-z]+/g) || []) {
    const name = key.slice(1), before = res && input.id ? rows.get(`${res.key}:${input.id}`) : undefined;
    idValue(input[name as keyof OperationInput] || before?.[name], name);
  }
  if (cap.key === "websites.publish") {
    await demandAccess(req, "web_pages.content.read", grant);
    const pages = await listWebmasterPages({ organizationId: req.user!.orgId, siteId: input.id, afterId: "", limit: 500 });
    if (pages.length === 500) throw new CreateError(413, "Review this site's larger publication directly in CRM.");
    const pageResource = resourceFor("web_pages")!;
    for (const page of pages) {
      const row = await rawRecord(req, pageResource, page.id, grant);
      const visible = await allowedFields(req, pageResource, grant, undefined, row);
      if (!["title", "path", "status", "contentJson"].every(field => visible.has(field))) throw new CreateError(403, "The connection must be able to review all published page content.");
      rows.set(`web_pages:${page.id}`, row);
      preview.targets.push({ resource: "web_pages", id: page.id, version: recordVersion(row) });
      if (page.status !== "ARCHIVED") preview.changes.push({ field: page.path, before: page.status, after: "PUBLISHED" });
    }
    const site = rows.get(`websites:${input.id}`) as unknown as WebmasterSiteRecord;
    const readiness = buildWebmasterPublishReadinessReport({ site, pages });
    if (!readiness.preflightPassed) throw new CreateError(409, "The site did not pass publishing checks. Open its publishing readiness report in Webmaster.");
  }
  if (cap.key === "constituents.merge" && fields.keepId === fields.mergeId) throw new CreateError(400, "Choose different constituents to merge.");
  if (cap.key === "letters.prepare_pdf") {
    await demandAccess(req, "constituents.contact.read", grant);
    await demandAccess(req, "letters.content.read", grant);
    if (fields.donationId) {
      await demandAccess(req, "gifts.giving.read", grant);
      if (rows.get(`gifts:${String(fields.donationId)}`)?.constituentId !== fields.constituentId) throw new CreateError(400, "Choose a gift belonging to this recipient.");
    }
    preview.heldEffects.push("Save a generated document for CRM review. Print, mail and email delivery are separate actions.");
  }
  if (cap.key === "gifts.create" || cap.key === "gifts.update" || cap.key === "constituents.create") preview.heldEffects.push("Automatic Steward Path triggers and accounting exports are held. Request those actions separately in CRM.");
  if (["paths.activate", "path_enrollments.create", "path_steps.create", "path_steps.update"].includes(cap.key)) {
    const pathId = input.pathId || input.id;
    const outbound = pathId && await prisma.stewardPathStep.findFirst({ where: { pathId, path: { organizationId: req.user!.orgId, crmScope: "DONOR" }, isActive: true, stepType: "SEND_EMAIL" }, select: { id: true } });
    if (outbound || fields.stepType === "SEND_EMAIL") throw new CreateError(403, "This path has automatic external delivery. Configure or enroll it through the CRM workflow after reviewing its send rules.");
  }
  if (cap.key.startsWith("path_steps.") || cap.key === "paths.activate") {
    const pathId = String(input.pathId || input.id);
    const active = await prisma.stewardPathEnrollment.findFirst({ where: { pathId, organizationId: req.user!.orgId, status: "ACTIVE" }, select: { id: true } });
    if (active) throw new CreateError(409, "Pause this path's active enrollments before changing its automatic behavior.");
    if (cap.key === "paths.activate" && rows.get(`paths:${pathId}`)?.triggerType !== "MANUAL") throw new CreateError(403, "Activate automatic trigger rules in Steward Paths after reviewing their downstream actions.");
  }
  if (cap.key === "path_enrollments.create") {
    const path = rows.get(`paths:${input.pathId}`);
    if (!path || !["CONSTITUENT", "DONOR"].includes(String(path.targetType))) throw new CreateError(400, "Choose a constituent or donor path for this enrollment.");
    preview.heldEffects.push("Enrollment starts paused. Review downstream writes in Steward Paths before activation.");
  }
  if (cap.key === "email.send" || cap.key === "email.schedule") {
    if (cap.key === "email.schedule") {
      const send = await demandAccess(req, "email.send", grant);
      if (send.mode === "approval") decision.mode = "approval";
      if (typeof fields.scheduledAt !== "string" || !Number.isFinite(Date.parse(fields.scheduledAt)) || Date.parse(fields.scheduledAt) > Date.now() + 30 * 86400000) throw new CreateError(400, "Choose a valid ISO send time within 30 days.");
    }
    if (!Array.isArray(fields.recipientEmails) || !fields.recipientEmails.length || fields.recipientEmails.length > decision.limits.maxRecipients) throw new CreateError(400, `Provide at most ${decision.limits.maxRecipients} verified recipient emails.`);
    const recipientEmails = [...new Set((fields.recipientEmails as string[]).map(email => email.trim().toLowerCase()))];
    const sendMode = recipientEmails.length === 1 ? "INDIVIDUAL" : "LIST";
    if (fields.sendMode && fields.sendMode !== sendMode) throw new CreateError(400, "Use INDIVIDUAL for one recipient or LIST for multiple recipients.");
    await demandAccess(req, "constituents.contact.read", grant);
    for (const email of recipientEmails) {
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CreateError(400, "Provide valid recipient email addresses.");
      const donor = await authorizedRecipient(req, grant, email);
      if (!donor) throw new CreateError(403, "Each recipient must resolve to one accessible active CRM constituent.");
      preview.targets.push({ resource: "constituents", id: String(donor.id), version: recordVersion(donor) });
    }
    const row = rows.get(`email:${input.id}`);
    if (!row) throw new CreateError(400, "Choose an email campaign.");
    if (row.status !== "DRAFT") throw new CreateError(409, "Choose an unsent draft. Unschedule an existing CRM send before submitting a new one.");
    await demandAccess(req, "email.content.read", grant);
    const emailFields = await allowedFields(req, resourceFor("email")!, grant, undefined, row);
    if (!["subject", "bodyHtml", "bodyText", "fromName", "fromEmail", "replyToEmail"].every(field => emailFields.has(field))) throw new CreateError(403, "The connection must be able to review the sender, subject and both message formats before sending.");
    const validation = await validateCampaignSendReadiness({ campaign: row as Parameters<typeof validateCampaignSendReadiness>[0]["campaign"], sendOptions: { sendMode, recipientEmails }, includeDeliveryReview: true });
    if (!validation.valid) throw new CreateError(400, `Campaign is not ready. ${validation.blockers.join(" ")}`);
    const delivery = validation.deliveryReview!;
    if (delivery.bodies.html.length + delivery.bodies.text.length > 200000) throw new CreateError(413, "Review and send this larger campaign from the CRM email workspace.");
    preview.changes.push({ field: "sender and subject", before: null, after: { name: row.fromName, email: row.fromEmail, replyTo: row.replyToEmail, subject: row.subject } }, { field: deliveryReviewField, before: null, after: delivery }, { field: "delivery readiness", before: null, after: validation.audience });
    preview.heldEffects.push("Delivery rechecks current contact preferences, suppression and sender readiness.");
  }
  return { preview, decision, rows };
}
async function authorizedRecipient(req: Request, grant: ChatGptGrant, email: string) {
  const res = resourceFor("constituents")!;
  const candidates = await prisma.constituent.findMany({ where: { organizationId: req.user!.orgId, closedAt: null, email }, select: { id: true }, take: 2 });
  if (candidates.length !== 1) return null;
  const row = await rawRecord(req, res, candidates[0].id, grant);
  const readable = await allowedFields(req, res, grant, undefined, row);
  return readable.has("email") ? row : null;
}
const importAdapter: AiCapability = { key: "records.import", title: "Import new constituents", module: "Data tools", read: false, risk: "consequential", permissions: ["import:data"], native: { router: "constituents", method: "POST", path: "/import" } };
const importInput = (records: unknown) => ({ records, mode: "create_only", duplicateResolution: "skip", matchEmail: true, matchPhone: true, allowOrgImport: false });
function importSummary(result: DataRow) { return Object.fromEntries(["created", "updated", "skipped", "duplicatesInFile", "errors", "importRunId"].filter(key => result[key] !== undefined).map(key => [key, result[key]])); }
function batchInputs(input: StoredRequest, limit: number) {
  const actions = input.fields?.actions as { capability: string; arguments: StoredRequest }[] | undefined;
  if (!actions?.length || actions.length > limit) throw new CreateError(400, `Provide 1–${limit} batch actions.`);
  return actions.map((child, index) => {
    const cap = capabilityFor(child.capability);
    if (!cap || cap.read || !cap.resource || cap.risk !== "routine" || /send|publish|activate/.test(cap.key)) throw new CreateError(400, `Batch item ${index + 1} must be a supported routine record action.`);
    return { cap, input: { ...child.arguments, requestKey: `${input.requestKey!.slice(0, 90)}:${index + 1}`, preview: false } };
  });
}
export async function submitOperation(req: Request, grant: ChatGptGrant, capability: string, input: StoredRequest, origin: string) {
  const cap = capabilityFor(capability);
  if (!cap || cap.read) throw new CreateError(400, "Choose a supported AI write action.");
  await demandAccess(req, cap.key, grant);
  const requestKey = input.requestKey;
  if (typeof requestKey !== "string" || requestKey.length < 8 || requestKey.length > 100) throw new CreateError(400, "Provide a stable requestKey between 8 and 100 characters.");
  const importFile = input.legacy?.name === "import_letter_image" ? input.legacy.arguments.file as { file_id?: string } | undefined : undefined;
  const hash = importFile ? toolFingerprint([cap.key, input.legacy!.arguments.name, importFile.file_id]) : toolFingerprint([cap.key, { ...input, preview: undefined }]);
  const existing = await prisma.aiOperation.findUnique({ where: { organizationId_actorId_requestKey: { organizationId: req.user!.orgId, actorId: req.user!.sub, requestKey } } });
  if (existing) {
    if (existing.fingerprint !== hash) throw new CreateError(409, "This requestKey already describes a different command.");
    return operationResult(req, grant, existing, origin, !!input.legacy);
  }
  const { preview, decision } = await preflight(req, grant, cap, input);
  if (input.preview) return { status: "PREVIEW", capability, mode: decision.mode, preview, reviewRequired: decision.mode === "approval" };
  let saved: AiOperation;
  try {
    const scheduledAt = capability === "email.schedule" ? new Date(String(input.fields?.scheduledAt)) : null;
    if (scheduledAt && scheduledAt <= new Date()) throw new CreateError(400, "Choose a send time in the future.");
    const pending = decision.mode === "approval";
    saved = await prisma.aiOperation.create({ data: { organizationId: req.user!.orgId, actorId: req.user!.sub, grantId: grant.id, capability, requestKey, fingerprint: hash, payloadJson: asJson(input), previewJson: asJson(preview), status: pending ? "PENDING" : scheduledAt ? "SCHEDULED" : "QUEUED", runAfter: scheduledAt, expiresAt: new Date((!pending && scheduledAt ? scheduledAt.getTime() : Date.now()) + 86400000) } });
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
  if (operation.organizationId !== req.user!.orgId || operation.actorId !== req.user!.sub || operation.grantId !== grant.id) throw new CreateError(404, "AI operation not found for this connection.");
  await demandAccess(req, operation.capability, grant);
  const result = operation.resultJson as Record<string, unknown> | null;
  if (legacy && operation.status === "SUCCEEDED") {
    const input = operation.payloadJson as unknown as StoredRequest;
    if (input.legacy?.name === "generate_letter_image" && typeof result?.jobId === "string") return getLetterImageJob(req, origin, result.jobId);
    return result;
  }
  if (legacy && ["FAILED", "STALE", "INTERRUPTED", "EXPIRED", "REJECTED", "CANCELLED"].includes(operation.status)) throw new CreateError(operation.status === "STALE" ? 409 : 400, operation.reviewReason || "This draft operation did not complete. Review its status in CRM.");
  const publicResult = result ? Object.fromEntries(Object.entries(result).filter(([key]) => key !== "export")) : null;
  return { operationId: operation.id, capability: operation.capability, status: operation.status, ...(publicResult ? { result: publicResult } : {}), ...(operation.status === "FAILED" || operation.status === "INTERRUPTED" || operation.status === "STALE" ? { message: operation.reviewReason } : {}), reviewRequired: operation.status === "PENDING", expiresAt: operation.expiresAt, runAfter: operation.runAfter, url: `${origin}/settings/ai-access?tab=${operation.status === "PENDING" ? "approvals" : "activity"}&operation=${operation.id}`, retryAfterSeconds: operation.status === "QUEUED" || operation.status === "RUNNING" ? 3 : undefined };
}
export async function cancelGrantOperations(tx: Prisma.TransactionClient, grantId: string) {
  await tx.aiOperation.updateMany({ where: { grantId, status: { in: pendingOperationStatuses } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  await tx.chatGptImageJob.updateMany({ where: { grantId, status: "QUEUED" }, data: { status: "FAILED", error: "The connection was disconnected before generation.", prompt: null } });
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
    const current = await prisma.customFieldValue.findFirst({ where: { fieldId: definition.id, entityId: String(fields.entityId) } });
    const expected = aiMutationContext.getStore()?.guards.find(guard => guard.model === "CustomFieldValue");
    if (!!current !== !!expected || current && expected?.id !== current.id) throw new CreateError(409, "The custom field changed before saving.");
    const value = fields.value === null ? null : JSON.stringify(fields.value);
    if (current) {
      const changed = await prisma.customFieldValue.updateMany({ where: { id: current.id, updatedAt: expected!.expected.updatedAt as Date }, data: { value } });
      if (changed.count !== 1) throw new CreateError(409, "The custom field changed before saving.");
      return { id: current.id };
    }
    const result = await prisma.customFieldValue.create({ data: { fieldId: definition.id, entityId: String(fields.entityId), entityType: String(fields.entityType), value } });
    return { id: result.id };
  }
  if (cap.handler === "settings") {
    if (data.fiscalYearStart !== undefined && (!Number.isInteger(data.fiscalYearStart) || Number(data.fiscalYearStart) < 1 || Number(data.fiscalYearStart) > 12)) throw new CreateError(400, "Choose a fiscal start month from 1 to 12.");
    if (data.timezone !== undefined) {
      try { Intl.DateTimeFormat("en", { timeZone: String(data.timezone) }); }
      catch { throw new CreateError(400, "Use an IANA timezone such as America/Chicago."); }
    }
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
  for (const key of ["item", "data", "campaign", "constituent", "donation", "guest", "table", "grant", "meeting", "task", "enrollment", "page", "site"]) {
    const nested = value[key]; if (nested && typeof nested === "object" && "id" in nested && typeof nested.id === "string") return nested.id;
  }
  return fallback;
}
async function runPrepared(req: Request, grant: ChatGptGrant, cap: AiCapability, input: StoredRequest, preview: Preview, rows: Map<string, DataRow>, operationId: string, origin: string) {
  const guards = [...rows.entries()].map(([key, row]) => ({ model: resourceFor(key.split(":")[0])!.model, id: String(row.id), expected: row }));
  const delivery = preview.changes.find(change => change.field === deliveryReviewField)?.after as EmailDeliveryReview | undefined;
  const eligibleRecipients = new Set(delivery?.recipients.map(email => email.toLowerCase()));
  const allowDelivery = delivery ? async (email: string) => {
    try {
      if (!eligibleRecipients.has(email.toLowerCase())) return false;
      const liveGrant = await currentGrant(grant.id, req.user!.orgId), liveActor = await actorRequest(req.user!.sub, req.user!.orgId);
      if (!(await effectiveConnectionConfig(liveActor, req.user!.orgId)).enabled) return false;
      const command = await demandAccess(liveActor, cap.key, liveGrant);
      const send = await demandAccess(liveActor, "email.send", liveGrant);
      const active = await prisma.aiOperation.findFirst({ where: { id: operationId, status: "RUNNING" }, select: { reviewedAt: true } });
      if (!active || (command.mode === "approval" || send.mode === "approval") && !active.reviewedAt) return false;
      const donor = await authorizedRecipient(liveActor, liveGrant, email);
      if (!donor || donor.doNotContact || donor.doNotEmail || donor.emailOptOut) return false;
      const lease = await prisma.aiOperation.updateMany({ where: { id: operationId, status: "RUNNING" }, data: { claimedAt: new Date() } });
      return lease.count === 1;
    } catch { return false; }
  } : undefined;
  return aiMutationContext.run({ operationId, guards, suppressImplicitEffects: true, allowDelivery, ...(delivery ? { approvedEmail: { campaignId: input.id!, bodies: delivery.bodies } } : {}) }, async () => {
    if (input.legacy) {
      if (!legacyExecutor) throw new CreateError(503, "The Studio command adapter is unavailable.");
      return legacyExecutor(req, grant.id, input.legacy.name, input.legacy.arguments, origin);
    }
    const res = cap.resource ? resourceFor(cap.resource) : undefined;
    const before = res && input.id ? rows.get(`${res.key}:${input.id}`) : undefined;
    let output: Record<string, unknown>;
    if (cap.native) {
      const parameters: Record<string, string> = {};
      for (const key of ["id", "eventId", "grantId", "pathId", "siteId", "key"] as const) if (input[key] || before?.[key]) parameters[key] = String(input[key] || before?.[key]);
      const body = { ...input.fields, ...cap.fixedFields };
      if (cap.key === "studio_content.update") {
        const campaign = rows.get(`create_campaigns:${String(before!.campaignId)}`)!;
        Object.assign(body, { design: body.designJson, revision: before!.revision, campaignRevision: campaign.revision });
        delete body.designJson;
      }
      if (cap.key === "constituents.tags.update") { body.tagNames = body.tags; delete body.tags; }
      if (cap.key === "path_enrollments.create") body.targetId = body.constituentId;
      if (allowDelivery) {
        const recipients = [...new Set((body.recipientEmails as string[]).map(email => email.trim().toLowerCase()))];
        Object.assign(body, { recipientEmails: recipients, sendMode: recipients.length === 1 ? "INDIVIDUAL" : "LIST" });
      }
      if (cap.key === "letters.prepare_pdf") Object.assign(body, { templateId: input.id, deliveryTarget: "PDF_ONLY" });
      // A native audience PUT requires a name even when only membership changes.
      if (cap.key === "audiences.update" && body.name === undefined) body.name = before?.name;
      output = await invokeNative(req, cap, parameters, body);
    } else output = await directAction(req, grant, cap, input, before);
    const savedId = resultId(output, input.id);
    const resultResource = cap.key === "letters.prepare_pdf" ? resourceFor("generated_letters") : res;
    return { resource: resultResource?.key, id: savedId ? `${resultResource?.key}:${savedId}` : undefined, url: resultResource && savedId ? recordUrl(resultResource, { ...before, ...input.fields, ...input, id: savedId }, origin) : `${origin}/settings/ai-access?tab=activity&operation=${operationId}`, heldEffects: preview.heldEffects, changedFields: Object.keys(input.fields || {}), ...(allowDelivery && output.sendSummary ? { delivery: output.sendSummary } : {}) };
  });
}
function equivalentPreview(current: Preview, approved: Preview) {
  return toolFingerprint([current.targets, current.changes, current.heldEffects, current.export]) === toolFingerprint([approved.targets, approved.changes, approved.heldEffects, approved.export]);
}
export async function authorizeReviewer(req: Request, cap: AiCapability, preview: Preview, org: string) {
  if (req.user!.orgId !== org) throw new CreateError(403, "The reviewer belongs to a different organization.");
  for (const permission of cap.permissions) await demand(req, permission);
  if (cap.resource) await demand(req, resourceFor(cap.resource)!.permission);
  if (cap.handler === "import") await demand(req, "view:constituents");
  if (preview.export) await demand(req, resourceFor(preview.export.resource)!.permission);
  if (cap.minRole) {
    const role = ROLE_HIERARCHY.indexOf(req.user!.role as typeof ROLE_HIERARCHY[number]);
    if (role < 0 || role > ROLE_HIERARCHY.indexOf(cap.minRole)) throw new CreateError(403, "The reviewer needs the role required to execute this CRM command.");
  }
  for (const child of preview.children || []) await authorizeReviewer(req, capabilityFor(child.capability)!, child.preview, org);
  const links: { id: string; resource: string; url: string }[] = [];
  for (const target of preview.targets || []) {
    if (target.resource === "studio_draft") {
      const { campaign } = await contentFor(req, target.id, true);
      links.push({ id: target.id, resource: target.resource, url: `/oyama-create/campaigns/${encodeURIComponent(campaign.id)}` });
      continue;
    }
    const res = resourceFor(target.resource)!;
    const siteRow = res.key === "websites" ? await getWebmasterSiteById({ organizationId: org, siteId: target.id }) : res.key === "web_pages" ? await getWebmasterPageById({ organizationId: org, pageId: target.id }) : undefined;
    const row = siteRow !== undefined ? siteRow as unknown as DataRow | null : await delegateFor(res).findFirst({ where: { AND: [tenantWhere(req, res), { id: target.id }] } });
    if (!row || !await nativeRowAccessible(req, res, row, res.key === cap.resource && !cap.read)) throw new CreateError(403, "The reviewer cannot inspect every affected CRM record.");
    links.push({ id: target.id, resource: target.resource, url: recordUrl(res, row, "") });
  }
  return links;
}
export async function executeOperation(id: string, origin: string) {
  const existing = await prisma.aiOperation.findUnique({ where: { id } });
  if (!existing || existing.status !== "QUEUED") return;
  const claimed = await prisma.aiOperation.updateMany({ where: { id, status: "QUEUED" }, data: { status: "RUNNING", claimedAt: new Date() } });
  if (!claimed.count) return;
  let executed = false;
  try {
    const grant = await currentGrant(existing.grantId, existing.organizationId), req = await actorRequest(existing.actorId, existing.organizationId);
    if (grant.userId !== existing.actorId) throw new CreateError(403, "The AI operation belongs to another account.");
    const configuration = await effectiveConnectionConfig(req, existing.organizationId);
    if (!configuration.enabled) throw new CreateError(403, "ChatGPT access is disabled for this installation.");
    origin = configuration.origin;
    const cap = capabilityFor(existing.capability)!, input = existing.payloadJson as unknown as StoredRequest;
    const { preview, decision, rows } = await preflight(req, grant, cap, input), approved = existing.previewJson as unknown as Preview;
    if (decision.mode === "approval" && !existing.reviewedAt) throw new CreateError(403, "This command now needs CRM approval.");
    if (existing.reviewedAt && !existing.reviewerId) throw new CreateError(403, "The approval reviewer is unavailable.");
    if (existing.reviewerId) {
      const reviewer = await actorRequest(existing.reviewerId, existing.organizationId);
      await authorizeReviewer(reviewer, cap, preview, existing.organizationId);
    }
    if (!equivalentPreview(preview, approved)) throw new CreateError(409, "Records changed after this command was prepared. Prepare a new command and approval.");
    if (existing.expiresAt <= new Date()) throw new CreateError(409, "This command expired. Prepare a new command.");
    let finalStatus = "SUCCEEDED";
    const result = await (async () => {
      executed = true;
      if (cap.handler === "export") {
        return { export: preview.export, downloadUrl: `${origin}/settings/ai-access?tab=activity&operation=${id}`, count: preview.export!.items.length, truncated: preview.export!.truncated };
      }
      if (cap.handler === "import") return importSummary(await aiMutationContext.run({ operationId: id, guards: [], suppressImplicitEffects: true }, () => invokeNative(req, importAdapter, {}, { ...importInput(input.fields?.records), dryRun: false })));
      if (cap.handler === "batch") {
        const children = batchInputs(input, decision.limits.maxBatch), items: { index: number; capability: string; status: string; result?: unknown; message?: string }[] = [];
        for (const [index, child] of children.entries()) {
          if (!await prisma.aiOperation.findFirst({ where: { id, status: "RUNNING" }, select: { id: true } })) break;
          const liveGrant = await currentGrant(grant.id, existing.organizationId);
          const liveActor = await actorRequest(existing.actorId, existing.organizationId);
          try {
            const checked = await preflight(liveActor, liveGrant, child.cap, child.input);
            if (!equivalentPreview(checked.preview, approved.children![index].preview)) throw new CreateError(409, "The target changed after the batch was prepared.");
            if (checked.decision.mode === "approval" && !existing.reviewedAt) throw new CreateError(403, "This item now requires CRM approval.");
            const outcome = await runPrepared(liveActor, liveGrant, child.cap, child.input, checked.preview, checked.rows, id, origin);
            items.push({ index: index + 1, capability: child.cap.key, status: "SUCCEEDED", result: outcome });
          } catch (error) {
            const known = error instanceof CreateError && error.status < 500;
            items.push({ index: index + 1, capability: child.cap.key, status: known ? "FAILED" : "INTERRUPTED", message: known ? error.message : "Check this CRM record before retrying." });
          }
          await prisma.aiOperation.updateMany({ where: { id, status: { in: ["RUNNING", "CANCELLED"] } }, data: { claimedAt: new Date(), resultJson: asJson({ items, processed: items.length, total: children.length }) } });
        }
        if (items.length < children.length) finalStatus = "CANCELLED";
        else if (items.some(item => item.status !== "SUCCEEDED")) finalStatus = "PARTIAL";
        return { items, processed: items.length, total: children.length };
      }
      return runPrepared(req, grant, cap, input, preview, rows, id, origin);
    })();
    await prisma.aiOperation.updateMany({ where: { id, status: "RUNNING" }, data: { status: finalStatus, resultJson: asJson(result), finishedAt: new Date() } });
    const auditAction = finalStatus === "PARTIAL" ? "AI_OPERATION_PARTIAL" : finalStatus === "CANCELLED" ? "AI_OPERATION_CANCELLED" : "AI_OPERATION_SUCCEEDED";
    await logAudit({ action: auditAction, userId: existing.actorId, organizationId: existing.organizationId, entity: "AiOperation", entityId: id, metadata: { capability: existing.capability, status: finalStatus } });
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
    if (!equivalentPreview(preview, row.previewJson as unknown as Preview)) throw new CreateError(409, "Records changed. Prepare a new request before approving.");
    await authorizeReviewer(req, cap, preview, row.organizationId);
  }
  if (approve && row.runAfter && row.runAfter <= new Date()) throw new CreateError(409, "The scheduled time has passed. Prepare a new request.");
  const status = approve ? row.runAfter ? "SCHEDULED" : "QUEUED" : "REJECTED";
  const changed = await prisma.aiOperation.updateMany({ where: { id, status: "PENDING", updatedAt: row.updatedAt }, data: { status, ...(approve && row.runAfter ? { expiresAt: new Date(row.runAfter.getTime() + 86400000) } : {}), reviewerId: req.user!.sub, reviewedAt: new Date(), reviewReason: reason?.slice(0, 500) || null } });
  if (!changed.count) throw new CreateError(409, "This approval was already handled.");
  await logAudit({ action: approve ? "AI_OPERATION_APPROVED" : "AI_OPERATION_REJECTED", userId: req.user!.sub, organizationId: req.user!.orgId, entity: "AiOperation", entityId: id, metadata: { capability: row.capability } });
  return { id, status };
}
export async function cancelOperation(req: Request, id: string) {
  const result = await prisma.aiOperation.updateMany({ where: { id, organizationId: req.user!.orgId, ...(req.user!.role === "admin" ? {} : { actorId: req.user!.sub }), OR: [{ status: { in: pendingOperationStatuses } }, { status: "RUNNING", capability: "records.batch" }] }, data: { status: "CANCELLED", finishedAt: new Date() } });
  if (!result.count) throw new CreateError(409, "This operation is unavailable or its current action has already started.");
  await logAudit({ action: "AI_OPERATION_CANCEL_REQUESTED", userId: req.user!.sub, organizationId: req.user!.orgId, entity: "AiOperation", entityId: id });
  return { id, status: "CANCELLED" };
}
export async function processAiOperations(origin: string) {
  const now = new Date();
  await prisma.aiOperation.updateMany({ where: { status: "SCHEDULED", runAfter: { lte: now }, expiresAt: { gt: now } }, data: { status: "QUEUED" } });
  await prisma.aiOperation.updateMany({ where: { status: { in: pendingOperationStatuses }, expiresAt: { lte: now } }, data: { status: "EXPIRED", finishedAt: now } });
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
