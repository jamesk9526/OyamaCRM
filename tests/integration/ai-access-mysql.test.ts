/** Use only a dedicated loopback schema with the repository migrations already applied. */
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({ send: vi.fn(async () => ({ acceptedAt: new Date(), providerResponse: "Synthetic acceptance", providerMessageId: "synthetic-message" })) }));
vi.mock("@/server/src/services/smtp-service", async importOriginal => ({ ...await importOriginal<object>(), createOrganizationEmailSender: async () => ({ mode: "SMTP", send: smtp.send }) }));

const testUrl = process.env.AI_ACCESS_MYSQL_TEST_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (url.protocol !== "mysql:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/oyama_ai_test_[a-z0-9_]+$/i.test(url.pathname)) throw new Error("AI_ACCESS_MYSQL_TEST_URL must point to a disposable loopback oyama_ai_test_* schema.");
  process.env.DATABASE_URL = testUrl;
}
const prefix = `synthetic-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`, foreign = `${prefix}-foreign`, actor = `${prefix}-actor`, donor = `${prefix}-donor`, gift = `${prefix}-gift`;
const origin = "https://crm.example.org", redirect = "https://chatgpt.com/connector_platform/oauth/callback";
let app: ReturnType<typeof express>, db: typeof import("@/server/src/lib/prisma")["prisma"];
let bearer = "", token = "", grantId = "", processQueue: typeof import("@/server/src/ai-access/operations")["processAiOperations"];
const api = (method: "get" | "post" | "put", path: string, data?: object) => request(app)[method](`/api/chatgpt${path}`).set("Authorization", `Bearer ${bearer}`).send(data);
async function tool(name: string, args: object = {}) {
  const response = await request(app).post("/api/chatgpt/mcp").set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  expect(response.body.result?.isError, JSON.stringify(response.body)).not.toBe(true);
  return response.body.result.structuredContent;
}
async function completedCommand(name: string, args: object) {
  let result = await tool(name, args);
  if (result.status === "PENDING") {
    const approved = await api("post", `/access/operations/${result.operationId}/decision`, { approved: true });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  }
  if (["PENDING", "QUEUED"].includes(result.status)) {
    await processQueue(origin);
    result = await tool("get_crm_operation", { id: result.operationId });
  }
  expect(result.status, JSON.stringify(result)).toBe("SUCCEEDED");
  return result.result;
}
async function connectAccount() {
  const { hashToken } = await import("@/server/src/chatgpt/config");
  const scope = "crm.read crm.write", consent = await api("get", `/access/consent?${new URLSearchParams({ scopes: scope })}`);
  expect(consent.status, JSON.stringify(consent.body)).toBe(200);
  const verifier = "z".repeat(43), challenge = Buffer.from(hashToken(verifier), "hex").toString("base64url"), resource = `${origin}/api/chatgpt/mcp`;
  const approved = await api("post", "/oauth/consent", { response_type: "code", client_id: "oyama-chatgpt", redirect_uri: redirect, resource, code_challenge: challenge, code_challenge_method: "S256", scope, approved: true, consentProof: consent.body.proof });
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  const code = new URL(approved.body.redirectUrl).searchParams.get("code");
  const exchanged = await request(app).post("/api/chatgpt/oauth/token").type("form").send({ grant_type: "authorization_code", code, client_id: "oyama-chatgpt", redirect_uri: redirect, code_verifier: verifier, resource });
  expect(exchanged.status, JSON.stringify(exchanged.body)).toBe(200);
  token = exchanged.body.access_token;
  grantId = (await db.chatGptGrant.findFirstOrThrow({ where: { organizationId: org, accessHash: hashToken(token) } })).id;
}
describe.skipIf(!testUrl)("AI access with real MariaDB persistence", () => {
  beforeAll(async () => {
    process.env.CHATGPT_ENABLED = "true"; process.env.CHATGPT_FORCE_DISABLED = "false";
    process.env.CHATGPT_PUBLIC_URL = origin; process.env.CHATGPT_REDIRECT_URIS = redirect;
    const [{ prisma }, { default: router }, { signAccessToken }, { presetRules }, { emptyAccessDocument }, { processAiOperations }] = await Promise.all([
      import("@/server/src/lib/prisma"), import("@/server/src/chatgpt/routes"), import("@/server/src/lib/auth"), import("@/server/src/ai-access/policy"), import("@/server/src/ai-access/contracts"), import("@/server/src/ai-access/operations"),
    ]);
    db = prisma; processQueue = processAiOperations;
    app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use("/api/chatgpt", router);
    app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => { void next; res.status(500).json({ error: error.message }); });
    await db.organization.createMany({ data: [{ id: org, name: "Synthetic nonprofit" }, { id: foreign, name: "Synthetic other tenant" }] });
    await db.user.create({ data: { id: actor, organizationId: org, role: "admin", email: `${actor}@example.invalid`, firstName: "Synthetic", lastName: "Admin" } });
    await db.organizationSettings.create({ data: { organizationId: org, currency: "USD" } });
    await db.constituent.createMany({ data: [{ id: donor, organizationId: org, firstName: "Jordan", lastName: "Synthetic", email: "test@example.invalid", notes: "Test-only note" }, { id: `${prefix}-outsider`, organizationId: foreign, firstName: "Jordan", lastName: "Foreign" }] });
    await db.constituentGroup.create({ data: { id: `${prefix}-group`, organizationId: org, name: "Synthetic business", groupType: "BUSINESS" } });
    await db.constituentGroupMember.create({ data: { groupId: `${prefix}-group`, constituentId: donor, relationshipLabel: "Owner" } });
    await db.tag.create({ data: { id: `${prefix}-tag`, organizationId: org, name: `${prefix} Tag` } });
    await db.constituentTag.create({ data: { constituentId: donor, tagId: `${prefix}-tag` } });
    await db.donation.create({ data: { id: gift, constituentId: donor, amount: 100.25, date: new Date("2026-01-10T12:00:00Z"), status: "COMPLETED" } });
    bearer = signAccessToken({ sub: actor, orgId: org, role: "admin", email: `${actor}@example.invalid` });
    const doc = { ...emptyAccessDocument(), organization: presetRules("supervised") };
    const saved = await api("put", "/access", { revision: 0, document: doc });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    await connectAccount();
  }, 30000);
  beforeEach(async () => {
    const { chatGptRateLimiter } = await import("@/server/src/chatgpt/routes");
    chatGptRateLimiter.resetKey("::ffff:127.0.0.1"); chatGptRateLimiter.resetKey("127.0.0.1");
  });
  afterAll(async () => { await db?.$disconnect(); });
  it("searches real records and returns donor context with exact giving totals", async () => {
    const search = await tool("search", { query: "Jordan Synthetic" });
    expect(search.results).toContainEqual(expect.objectContaining({ id: `constituents:${donor}`, url: `${origin}/constituents/${donor}` }));
    expect(search.results.some((row: { title: string }) => row.title.includes("Foreign"))).toBe(false);
    const context = await tool("get_crm_context", { id: `constituents:${donor}` });
    expect(context.record.fields.notes).toBe("Test-only note");
    expect(context.related.gifts.items[0].fields.amount).toBe("100.25");
    const trend = await tool("run_crm_analytics", { report: "giving-trend", from: "2026-01-01", through: "2026-01-31" });
    expect(trend.totalCompletedGiving).toBe(100.25);
  });
  it("uses the native task and constituent handlers and preserves versions and receipts", async () => {
    const before = await tool("get_crm_record", { id: `constituents:${donor}` });
    const input = { id: donor, expectedVersion: before.version, requestKey: `${prefix}-address`, fields: { addressLine1: "123 Synthetic Avenue" } };
    expect((await tool("crm_constituents_update", input)).status).toBe("SUCCEEDED");
    expect((await db.constituent.findUniqueOrThrow({ where: { id: donor } })).addressLine1).toBe("123 Synthetic Avenue");
    expect(await db.constituentGroupMember.count({ where: { constituentId: donor } })).toBe(1);
    expect(await db.constituentTag.count({ where: { constituentId: donor } })).toBe(1);
    expect((await tool("crm_constituents_update", input)).status).toBe("SUCCEEDED");
    expect(await db.aiOperation.count({ where: { organizationId: org, requestKey: input.requestKey } })).toBe(1);
    const task = await tool("crm_tasks_create", { requestKey: `${prefix}-task`, fields: { title: "Call the synthetic donor", constituentId: donor } });
    expect(task.status).toBe("SUCCEEDED");
    expect(await db.task.count({ where: { organizationId: org, constituentId: donor } })).toBe(1);
  });
  it("updates verified tags and relationships and holds Steward enrollment effects", async () => {
    const before = await tool("get_crm_record", { id: `constituents:${donor}` });
    const tags = await tool("crm_constituents_tags_update", { id: donor, expectedVersion: before.version, requestKey: `${prefix}-set-tags`, fields: { tags: [`${prefix} Tag`] } });
    expect(tags.status, JSON.stringify(tags)).toBe("SUCCEEDED");
    const current = await tool("get_crm_record", { id: `constituents:${donor}` });
    const groups = await tool("crm_constituents_groups_update", { id: donor, expectedVersion: current.version, requestKey: `${prefix}-set-groups`, fields: { groupMemberships: [{ groupId: `${prefix}-group`, relationshipLabel: "Primary contact", isPrimary: true }] } });
    expect(groups.status, JSON.stringify(groups)).toBe("SUCCEEDED");
    const context = await tool("get_crm_context", { id: `constituents:${donor}` });
    expect(context.tags[0].id).toBe(`tags:${prefix}-tag`);
    expect(context.related.group_members.items[0].fields.relationshipLabel).toBe("Primary contact");
    const path = await tool("crm_paths_create", { requestKey: `${prefix}-path`, fields: { name: "Synthetic manual follow-up", targetType: "CONSTITUENT" } });
    expect(path.status, JSON.stringify(path)).toBe("SUCCEEDED");
    const pathId = path.result.id.split(":")[1];
    const step = await tool("crm_path_steps_create", { pathId, requestKey: `${prefix}-path-step`, fields: { name: "Review donor", stepType: "MANUAL_ACTION" } });
    expect(step.status, JSON.stringify(step)).toBe("SUCCEEDED");
    const pending = await tool("crm_path_enrollments_create", { pathId, requestKey: `${prefix}-enroll`, fields: { constituentId: donor } });
    expect((await api("post", `/access/operations/${pending.operationId}/decision`, { approved: true })).status).toBe(200);
    await processQueue(origin);
    const receipt = await tool("get_crm_operation", { id: pending.operationId });
    expect(receipt.status, JSON.stringify(receipt)).toBe("SUCCEEDED");
    const enrollment = await db.stewardPathEnrollment.findFirstOrThrow({ where: { pathId, constituentId: donor } });
    expect(enrollment.status).toBe("PAUSED"); expect(enrollment.nextStepDueAt).toBeNull();
  });
  it("applies one approved gift correction under concurrent worker claims", async () => {
    const old = await tool("get_crm_record", { id: `gifts:${gift}` });
    const submitted = await tool("crm_gifts_update", { id: gift, expectedVersion: old.version, requestKey: `${prefix}-correct`, fields: { amount: 101.5 } });
    expect(submitted.status).toBe("PENDING");
    expect((await db.donation.findUniqueOrThrow({ where: { id: gift } })).amount.toFixed(2)).toBe("100.25");
    const approved = await api("post", `/access/operations/${submitted.operationId}/decision`, { approved: true });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    await Promise.all([processQueue(origin), processQueue(origin)]);
    const receipt = await tool("get_crm_operation", { id: submitted.operationId });
    expect(receipt.status, JSON.stringify(receipt)).toBe("SUCCEEDED");
    expect((await db.donation.findUniqueOrThrow({ where: { id: gift } })).amount.toFixed(2)).toBe("101.50");
    expect(await db.qBSyncQueueItem.count({ where: { organizationId: org, donationId: gift } })).toBe(0);
  });
  it("prepares outreach from a lapsed cohort and sends once after CRM approval", async () => {
    const cohort = await tool("run_crm_analytics", { report: "lapsed-donors", from: "2026-02-01", through: "2026-02-28" });
    const person = cohort.rows.find((row: { id: string }) => row.id === `constituents:${donor}`);
    expect(person.fields.email).toBe("test@example.invalid");
    const draft = await tool("crm_email_draft_create", { requestKey: `${prefix}-outreach`, fields: { name: "Synthetic donor outreach", subject: "Thank you for your past support", fromEmail: "staff@example.invalid", purpose: "THANK_YOU", bodyText: "Thank you for supporting the synthetic nonprofit." } });
    expect(draft.status, JSON.stringify(draft)).toBe("SUCCEEDED");
    const email = await tool("get_crm_record", { id: draft.result.id });
    const { validateCampaignSendReadiness } = await import("@/server/src/routes/email-campaigns");
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: email.id.split(":")[1] } });
    const readiness = await validateCampaignSendReadiness({ campaign, sendOptions: { sendMode: "INDIVIDUAL", recipientEmails: [person.fields.email] } });
    expect(readiness.valid, JSON.stringify(readiness.blockers)).toBe(true);
    const ready = await tool("crm_email_send", { id: email.id.split(":")[1], expectedVersion: email.version, requestKey: `${prefix}-send`, fields: { recipientEmails: [person.fields.email] } });
    expect(ready.status).toBe("PENDING"); expect(smtp.send).not.toHaveBeenCalled();
    const response = await api("post", `/access/operations/${ready.operationId}/decision`, { approved: true });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    await Promise.all([processQueue(origin), processQueue(origin)]);
    const completed = await tool("get_crm_operation", { id: ready.operationId });
    expect(completed.status, JSON.stringify(completed)).toBe("SUCCEEDED");
    expect(smtp.send).toHaveBeenCalledTimes(1);
  });
  it("executes a bounded batch with per-item results and prepares a downloadable export", async () => {
    const result = await tool("crm_records_batch", { requestKey: `${prefix}-batch`, fields: { actions: [
      { capability: "tasks.create", arguments: { fields: { title: "Synthetic batch task", constituentId: donor } } },
      { capability: "campaigns.create", arguments: { fields: { name: "Synthetic batch campaign", startDate: "2026-01-01" } } },
    ] } });
    const approve = await api("post", `/access/operations/${result.operationId}/decision`, { approved: true });
    expect(approve.status, JSON.stringify(approve.body)).toBe(200);
    await processQueue(origin);
    const completed = await tool("get_crm_operation", { id: result.operationId });
    expect(completed.status, JSON.stringify(completed)).toBe("SUCCEEDED");
    expect(completed.result.items).toHaveLength(2);
    const pending = await tool("crm_records_export", { requestKey: `${prefix}-export`, fields: { resource: "constituents", query: "Jordan Synthetic" } });
    expect((await api("post", `/access/operations/${pending.operationId}/decision`, { approved: true })).status).toBe(200);
    await processQueue(origin);
    const csv = await api("get", `/access/operations/${pending.operationId}/export`);
    expect(csv.status, csv.text).toBe(200);
    expect(csv.text).toContain("Jordan"); expect(csv.text).not.toContain("Foreign");
  });
  it("uses opaque connection-bound pagination without returning closed constituents", async () => {
    await db.constituent.createMany({ data: [
      { id: `${prefix}-page-a`, organizationId: org, firstName: "Page", lastName: "Alpha" },
      { id: `${prefix}-page-b`, organizationId: org, firstName: "Page", lastName: "Beta" },
      { id: `${prefix}-page-c`, organizationId: org, firstName: "Page", lastName: "Closed", closedAt: new Date() },
    ] });
    const page = await tool("search_crm_records", { resource: "constituents", query: "Page", limit: 1 });
    expect(page.items).toHaveLength(1); expect(page.nextCursor).toBeTypeOf("string");
    expect(Buffer.from(page.nextCursor, "base64url").toString("utf8")).not.toContain(prefix);
    const next = await tool("search_crm_records", { resource: "constituents", query: "Page", limit: 1, cursor: page.nextCursor });
    expect(next.items).toHaveLength(1); expect(next.items[0].id).not.toBe(page.items[0].id); expect(next.nextCursor).toBeNull();
    const invalid = await request(app).post("/api/chatgpt/mcp").set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_crm_records", arguments: { resource: "constituents", query: "different", cursor: page.nextCursor } } });
    expect(invalid.body.result.isError).toBe(true);
  });
  it("uses native event registration, grants and volunteer services", async () => {
    const event = await completedCommand("crm_events_create", { requestKey: `${prefix}-event`, fields: { name: "Synthetic volunteer dinner", startDate: "2026-12-05T18:00:00Z" } });
    const eventId = event.id.split(":")[1];
    const guest = await completedCommand("crm_event_guests_create", { eventId, requestKey: `${prefix}-guest`, fields: { firstName: "Jordan", lastName: "Synthetic", constituentId: donor } });
    const ticket = await completedCommand("crm_ticket_types_create", { eventId, requestKey: `${prefix}-ticket`, fields: { name: "Synthetic ticket", price: 25, capacity: 20 } });
    const table = await completedCommand("crm_event_tables_create", { eventId, requestKey: `${prefix}-table`, fields: { name: "Synthetic table", capacity: 4 } });
    expect(await db.eventGuest.count({ where: { id: guest.id.split(":")[1], eventId } })).toBe(1);
    expect((await tool("get_crm_record", { id: ticket.id })).fields.price).toBe("25");
    expect(table.id).toMatch(/^event_tables:/);
    const hours = await completedCommand("crm_volunteer_hours_create", { requestKey: `${prefix}-hours`, fields: { constituentId: donor, eventId, hours: 2.5, date: "2026-12-05", description: "Synthetic setup work" } });
    expect((await tool("get_crm_record", { id: hours.id })).fields.hours).toBe("2.5");
    const funder = await completedCommand("crm_funders_create", { requestKey: `${prefix}-funder`, fields: { name: "Synthetic foundation" } });
    const grant = await completedCommand("crm_grants_create", { requestKey: `${prefix}-grant`, fields: { funderId: funder.id.split(":")[1], title: "Synthetic family support", amountRequested: 1000, applicationDeadline: "2026-12-15" } });
    const context = await tool("get_crm_context", { id: grant.id });
    expect(context.record.fields.title).toBe("Synthetic family support");
    expect(context.related.grant_sections.items.length).toBeGreaterThan(0);
    const timeline = await tool("get_crm_timeline", { id: `constituents:${donor}`, limit: 1 });
    expect(timeline.items).toHaveLength(1);
    expect(timeline.items[0].resource).toBe("activities");
  });
  it("revises an existing Studio draft through native revision and asset checks", async () => {
    const { defaultDesign } = await import("@/server/src/oyama-create/studio/design");
    const { baselineBrand } = await import("@/server/src/oyama-create/studio/brand-service");
    const design = { ...defaultDesign(), brandRevisionId: await baselineBrand(org, actor) };
    const campaign = await db.createCampaign.create({ data: { organizationId: org, ownerId: actor, name: "Synthetic existing Studio campaign", channelsJson: ["LETTER"], audienceListIds: [] } });
    const content = await db.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name: "Synthetic Studio letter", documentJson: { version: 1, blocks: [] }, designJson: JSON.parse(JSON.stringify(design)) } });
    const current = await tool("get_crm_record", { id: `studio_content:${content.id}` });
    const proposed = { ...design, body: { type: "doc", content: [{ type: "paragraph", attrs: { studioId: "synthetic-paragraph" }, content: [{ type: "text", text: "Supporting families in our synthetic community" }] }] } };
    const result = await completedCommand("crm_studio_content_update", { id: content.id, expectedVersion: current.version, requestKey: `${prefix}-studio-edit`, fields: { designJson: proposed } });
    expect(result.id).toBe(`studio_content:${content.id}`);
    const saved = await db.createContent.findUniqueOrThrow({ where: { id: content.id } });
    expect(saved.revision).toBe(2);
    expect(JSON.stringify(saved.designJson)).toContain("Supporting families in our synthetic community");
    expect(await db.createRelease.count({ where: { campaignId: campaign.id } })).toBe(0);
    expect(await db.createDocumentRevision.count({ where: { contentId: content.id } })).toBe(1);
  });
  it("validates custom field types, consent expansion and duplicate-safe constituent imports", async () => {
    const definition = await completedCommand("crm_custom_fields_create", { requestKey: `${prefix}-custom`, fields: { entityType: "constituent", key: "syntheticOptions", name: "Synthetic preference", fieldType: "multiselect", options: ["Newsletter", "Events"] } });
    const beforeConsent = await tool("search_crm_records", { resource: "custom_fields" });
    expect(beforeConsent.items.some((item: { id: string }) => item.id === definition.id)).toBe(false);
    await connectAccount();
    const person = await tool("get_crm_record", { id: `constituents:${donor}` });
    await completedCommand("crm_custom_values_update", { expectedVersion: person.version, requestKey: `${prefix}-custom-value`, fields: { entityType: "constituent", entityId: donor, fieldId: definition.id.split(":")[1], value: ["Newsletter", "Events"] } });
    const saved = await db.customFieldValue.findFirstOrThrow({ where: { fieldId: definition.id.split(":")[1], entityId: donor } });
    expect(JSON.parse(saved.value!)).toEqual(["Newsletter", "Events"]);
    const imported = await completedCommand("crm_records_import", { requestKey: `${prefix}-import`, fields: { records: [{ firstName: "New", lastName: "Synthetic", email: `${prefix}@example.invalid` }, { firstName: "Jordan", lastName: "Synthetic", email: "test@example.invalid" }] } });
    expect(imported.created).toBe(1);
    expect(await db.constituent.count({ where: { organizationId: org, email: "test@example.invalid" } })).toBe(1);
    expect(await db.constituent.count({ where: { organizationId: org, email: `${prefix}@example.invalid` } })).toBe(1);
  });
  it("publishes real Webmaster content atomically and checks page versions", async () => {
    const site = await tool("crm_websites_create", { requestKey: `${prefix}-website`, fields: { name: "Synthetic public site", slug: prefix } });
    expect(site.status, JSON.stringify(site)).toBe("SUCCEEDED");
    expect(site.result.id).toMatch(/^websites:/);
    const siteId = site.result.id.split(":")[1];
    const page = await tool("crm_web_pages_create", { siteId, requestKey: `${prefix}-webpage`, fields: { title: "Synthetic welcome", slug: "welcome", path: "/", seoTitle: "Synthetic nonprofit", seoDescription: "Synthetic verification page", contentJson: { blocks: [{ id: "intro", type: "text", text: "Welcome to our test site" }] } } });
    expect(page.status, JSON.stringify(page)).toBe("SUCCEEDED");
    const fetched = await tool("get_crm_record", { id: page.result.id });
    const edited = await tool("crm_web_pages_update", { id: fetched.id.split(":")[1], expectedVersion: fetched.version, requestKey: `${prefix}-webedit`, fields: { title: "Synthetic revised welcome" } });
    expect(edited.status, JSON.stringify(edited)).toBe("SUCCEEDED");
    const current = await tool("get_crm_record", { id: site.result.id });
    const publish = await tool("crm_websites_publish", { id: siteId, expectedVersion: current.version, requestKey: `${prefix}-publish`, fields: {} });
    expect(publish.status).toBe("PENDING");
    const details = await api("get", `/access/operations/${publish.operationId}`);
    expect(details.status, JSON.stringify(details.body)).toBe(200);
    expect(details.body.links).toContainEqual(expect.objectContaining({ id: fetched.id.split(":")[1], url: "/webmaster" }));
    expect((await api("post", `/access/operations/${publish.operationId}/decision`, { approved: true })).status).toBe(200);
    await processQueue(origin);
    const receipt = await tool("get_crm_operation", { id: publish.operationId });
    expect(receipt.status, JSON.stringify(receipt)).toBe("SUCCEEDED");
    expect((await tool("get_crm_record", { id: page.result.id })).fields.status).toBe("PUBLISHED");
    const { getWebmasterSiteById, updateWebmasterPage } = await import("@/server/src/services/webmaster-store");
    const stored = await getWebmasterSiteById({ organizationId: org, siteId });
    expect(stored?.publishedVersionId).toBeTruthy();
    const { aiMutationContext } = await import("@/server/src/ai-access/mutation-context");
    await expect(aiMutationContext.run({ operationId: publish.operationId, guards: [{ model: "WebmasterPage", id: fetched.id.split(":")[1], expected: { id: fetched.id.split(":")[1], title: "Stale version" } }], suppressImplicitEffects: true }, () => updateWebmasterPage({ organizationId: org, pageId: fetched.id.split(":")[1], title: "Unexpected change" }))).rejects.toThrow("changed");
    expect((await tool("get_crm_record", { id: page.result.id })).fields.title).toBe("Synthetic revised welcome");
  });
  it("invalidates approval when the actual email body or eligible recipients change", async () => {
    const draft = await tool("crm_email_draft_create", { requestKey: `${prefix}-changed-mail`, fields: { name: "Synthetic approval fixture", subject: "Synthetic thank you", fromEmail: "staff@example.invalid", purpose: "THANK_YOU", bodyText: "Original approved content" } });
    const email = await tool("get_crm_record", { id: draft.result.id });
    const pending = await tool("crm_email_send", { id: email.id.split(":")[1], expectedVersion: email.version, requestKey: `${prefix}-changed-send`, fields: { recipientEmails: ["test@example.invalid"] } });
    const details = await api("get", `/access/operations/${pending.operationId}`);
    const content = details.body.preview.changes.find((change: { field: string }) => change.field === "delivery content and eligible recipients");
    expect(content.after.bodies.text).toContain("Original approved content");
    expect(content.after.recipients).toEqual(["test@example.invalid"]);
    expect((await api("post", `/access/operations/${pending.operationId}/decision`, { approved: true })).status).toBe(200);
    await db.emailCampaign.update({ where: { id: email.id.split(":")[1] }, data: { bodyText: "Changed after approval" } });
    await processQueue(origin);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: pending.operationId } })).status).toBe("STALE");
    expect(smtp.send).toHaveBeenCalledTimes(1);
  });
  it("persists interrupted worker outcomes and partial batch results without replaying sends", async () => {
    const interrupted = await db.aiOperation.create({ data: { organizationId: org, actorId: actor, grantId, capability: "email.send", requestKey: `${prefix}-interrupted`, fingerprint: "1".repeat(64), payloadJson: {}, previewJson: {}, status: "RUNNING", claimedAt: new Date(Date.now() - 11 * 60000), expiresAt: new Date(Date.now() + 86400000) } });
    await processQueue(origin); await processQueue(origin);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: interrupted.id } })).status).toBe("INTERRUPTED");
    expect(smtp.send).toHaveBeenCalledTimes(1);
    const batch = await tool("crm_records_batch", { requestKey: `${prefix}-partial-batch`, fields: { actions: [
      { capability: "tasks.create", arguments: { fields: { title: "First synthetic partial task", constituentId: donor } } },
      { capability: "meetings.create", arguments: { fields: { title: "Invalid synthetic meeting", startTime: "2026-11-05T10:00:00Z", endTime: "2026-11-05T09:00:00Z" } } },
    ] } });
    expect((await api("post", `/access/operations/${batch.operationId}/decision`, { approved: true })).status).toBe(200);
    await processQueue(origin);
    const completed = await tool("get_crm_operation", { id: batch.operationId });
    expect(completed.status, JSON.stringify(completed)).toBe("PARTIAL");
    expect(completed.result.items.map((item: { status: string }) => item.status)).toEqual(["SUCCEEDED", "FAILED"]);
    await processQueue(origin);
    expect(await db.task.count({ where: { organizationId: org, title: "First synthetic partial task" } })).toBe(1);
  });
  it("cancels the remaining items in a running batch and preserves completed outcomes", async () => {
    const batch = await tool("crm_records_batch", { requestKey: `${prefix}-cancel-batch`, fields: { actions: Array.from({ length: 20 }, (_, index) => ({ capability: "tasks.create", arguments: { fields: { title: `Synthetic cancellable task ${index + 1}`, constituentId: donor } } })) } });
    expect((await api("post", `/access/operations/${batch.operationId}/decision`, { approved: true })).status).toBe(200);
    const worker = processQueue(origin);
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const live = await db.aiOperation.findUniqueOrThrow({ where: { id: batch.operationId } });
        const progress = live.resultJson as { processed?: number } | null;
        if (progress?.processed) break;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      const cancelled = await api("post", `/access/operations/${batch.operationId}/cancel`, {});
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    } finally { await worker; }
    const receipt = await tool("get_crm_operation", { id: batch.operationId });
    expect(receipt.status).toBe("CANCELLED");
    expect(receipt.result.processed).toBeGreaterThan(0); expect(receipt.result.processed).toBeLessThan(20);
    expect(receipt.result.items.every((item: { status: string }) => item.status === "SUCCEEDED")).toBe(true);
    expect(await db.task.count({ where: { organizationId: org, title: { startsWith: "Synthetic cancellable task" } } })).toBe(receipt.result.processed);
  });
  it("explains a denied field and permanently cancels queued work when access is reduced", async () => {
    const queued = await db.aiOperation.create({ data: { organizationId: org, actorId: actor, grantId, capability: "email.schedule", requestKey: `${prefix}-reduced-job`, fingerprint: "2".repeat(64), payloadJson: {}, previewJson: {}, status: "SCHEDULED", runAfter: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 86400000) } });
    const current = await api("get", "/access");
    current.body.document.organization["constituents.contact.read"] = { mode: "blocked" };
    current.body.document.organization["constituents.tags.update"] = { mode: "automatic", fields: [] };
    const saved = await api("put", "/access", { revision: current.body.revision, document: current.body.document });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe("CANCELLED");
    const explanation = await tool("get_crm_capabilities", { capability: "constituents.read", recordId: `constituents:${donor}`, field: "email" });
    expect(explanation.mode).toBe("blocked");
    expect(explanation.reasons.join(" ")).toContain("constituents.contact.read");
    const person = await tool("get_crm_record", { id: `constituents:${donor}` });
    const denied = await request(app).post("/api/chatgpt/mcp").set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "crm_constituents_tags_update", arguments: { id: donor, expectedVersion: person.version, requestKey: `${prefix}-denied-tags`, fields: { tags: [] } } } });
    expect(denied.body.result.isError).toBe(true);
    expect(await db.constituentTag.count({ where: { constituentId: donor } })).toBe(1);
    current.body.document.organization["constituents.contact.read"] = { mode: "automatic" };
    current.body.document.organization["constituents.tags.update"] = { mode: "automatic" };
    expect((await api("put", "/access", { revision: saved.body.revision, document: current.body.document })).status).toBe(200);
    await processQueue(origin);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe("CANCELLED");
  });
  it("rechecks record state after approval and cancels scheduled work on revoke", async () => {
    const old = await tool("get_crm_record", { id: `gifts:${gift}` });
    const submitted = await tool("crm_gifts_update", { id: gift, expectedVersion: old.version, requestKey: `${prefix}-stale`, fields: { amount: 102.25 } });
    const approved = await api("post", `/access/operations/${submitted.operationId}/decision`, { approved: true });
    expect(approved.status).toBe(200);
    await db.donation.update({ where: { id: gift }, data: { amount: 105 } });
    await processQueue(origin);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: submitted.operationId } })).status).toBe("STALE");
    expect((await db.donation.findUniqueOrThrow({ where: { id: gift } })).amount.toFixed(2)).toBe("105.00");
    const future = await db.aiOperation.create({ data: { organizationId: org, actorId: actor, grantId, capability: "email.schedule", requestKey: `${prefix}-future`, fingerprint: "0".repeat(64), payloadJson: {}, previewJson: {}, status: "SCHEDULED", runAfter: new Date(Date.now() + 60000), expiresAt: new Date(Date.now() + 86400000) } });
    expect((await request(app).delete(`/api/chatgpt/access/connections/${grantId}`).set("Authorization", `Bearer ${bearer}`)).status).toBe(204);
    expect((await db.aiOperation.findUniqueOrThrow({ where: { id: future.id } })).status).toBe("CANCELLED");
  });
});
