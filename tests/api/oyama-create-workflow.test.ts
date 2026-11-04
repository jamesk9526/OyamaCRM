/** Real HTTP/auth/workflow handlers with explicitly synthetic persistence and provider fixtures. */
import "dotenv/config";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
vi.mock("@/server/src/routes/email-campaigns", () => ({ validateCampaignSendReadiness: vi.fn(async () => ({ valid: true, checks: [], blockers: [] })), buildCampaignDeliveryBodies: (input: { bodyHtml: string; bodyText: string }) => ({ html: input.bodyHtml, text: input.bodyText }), sendCampaignNow: vi.fn(async () => ({})) }));
vi.mock("@/server/src/services/smtp-service", () => ({ createOrganizationEmailSender: vi.fn(async () => ({ send: vi.fn() })) }));
vi.mock("@/server/src/services/organization-branding", () => ({ loadOrganizationBrandingContext: vi.fn(async () => ({})) }));
vi.mock("@/server/src/services/letter-production", async importOriginal => ({ ...await importOriginal<object>(), productionEnabled: vi.fn(async () => true), buildProductionSnapshot: vi.fn(async (input: { organizationId: string; templateId: string; bodyHtml: string; subject: string }) => ({ version: 2, organizationId: input.organizationId, templateId: input.templateId, revision: 1, bodyHtml: input.bodyHtml, subject: input.subject, assets: {}, branding: { organizationName: "Synthetic test organization" }, header: {}, footer: {}, signature: {}, warnings: [], blockers: [], generatedAt: "2026-11-03T12:00:00Z" })) }));
vi.mock("@/server/src/services/letters-execution", () => ({ resolveLetterMergeContext: vi.fn(async (input: { template: { printBody: string; printSubject: string } }) => ({ mergedPrintBody: input.template.printBody, mergedPrintSubject: input.template.printSubject, missingFields: [], unsupportedFields: [] })) }));
import routes from "@/server/src/oyama-create/routes";
import { signAccessToken } from "@/server/src/lib/auth";
import { variantFrom } from "@/server/src/oyama-create/domain";
import { invalidateLegacyBindings } from "@/server/src/oyama-create/legacy-invalidation";
import { encryptCredential } from "@/server/src/services/credential-encryption";
import { processCreateQueue } from "@/server/src/oyama-create/worker";
const app = express(); app.use(express.json()); app.use("/api/oyama-create", routes);
app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => { if (res.headersSent) { next(error); return; } res.status(500).json({ error: { message: error.message } }); });
const org = "synthetic-create-org";
const token = (organizationId = org, role = "admin") => signAccessToken({ sub: "synthetic-user", email: "synthetic@example.invalid", orgId: organizationId, role });
const call = (method: "get" | "post" | "patch" | "put", path: string, body?: unknown, organizationId = org, role = "admin") => { const result = request(app)[method](`/api/oyama-create${path}`).set("Authorization", `Bearer ${token(organizationId, role)}`); return body === undefined ? result : result.send(body as object); };
const doc = { version: 1, blocks: [{ id: "copy", kind: "paragraph", text: "Synthetic shared appeal" }] };
async function setup(channels = ["EMAIL", "LETTER"], mode: string | null = "BOTH") {
  const campaign = await db.createCampaign.create({ data: { organizationId: org, ownerId: "synthetic-user", name: "Synthetic appeal", objective: "FUNDRAISING", channelsJson: channels, audienceListIds: ["audience"], deliveryMode: mode } });
  const content = await db.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name: "Appeal message", documentJson: doc } });
  for (const channel of channels) await db.createVariant.create({ data: { organizationId: org, contentId: content.id, channel, documentJson: variantFrom({ subject: "Synthetic appeal subject", caption: channel === "SMS" ? "Synthetic SMS" : "" }) } });
  return { campaign, content };
}
beforeEach(async () => {
  resetCreateRows(); process.env.CREDENTIAL_ENCRYPTION_KEY = "1".repeat(64);
  rows.organizationSettings.push({ id: "settings", organizationId: org, oyamaCreateEnabled: true, smtpFromName: "Synthetic sender", smtpFromEmail: "sender@example.invalid" });
  rows.user.push({ id: "synthetic-user", organizationId: org, active: true, role: "admin" });
  rows.emailRecipientList.push({ id: "audience", organizationId: org, name: "Synthetic mixed audience" });
  rows.emailRecipientListMember.push({ id: "member", listId: "audience", constituentId: "person", email: "synthetic@example.invalid" });
  rows.constituent.push({ id: "person", organizationId: org, firstName: "Synthetic", lastName: "Recipient", email: "synthetic@example.invalid", phone: "+15555550101", addressLine1: "100 Test Way", addressLine2: "", city: "Test City", state: "IL", zip: "60000", country: "US", doNotMail: false, doNotContact: false, doNotEmail: false, emailOptOut: false });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
// Keep the compliance fixture deterministic while testing Create's routing and approval behavior.
vi.mock("@/server/src/services/email-compliance", () => ({ evaluateRecipientEligibility: async ({ candidates }: { candidates: Array<{ email: string; doNotContact: boolean }> }) => ({ recipients: candidates.filter(row => row.email && !row.doNotContact).map(row => row.email) }) }));
describe("oyamaCreate HTTP boundaries", () => {
  it("searches campaign names on the server before limiting the result list", async () => { await setup(["WEB"]); const older = await db.createCampaign.create({ data: { organizationId: org, ownerId: "synthetic-user", name: "Earlier community campaign", channelsJson: ["WEB"], audienceListIds: [], isTemplate: false } }); const result = await call("get", "/campaigns?q=Earlier%20community"); expect(result.status).toBe(200); expect(result.body.items.map((item: { id: string }) => item.id)).toEqual([older.id]); });
  it("requires authentication and denies client-care-only accounts", async () => { expect((await request(app).get("/api/oyama-create/campaigns")).status).toBe(401); expect((await call("get", "/campaigns", undefined, org, "compassion_user")).status).toBe(403); });
  it("protects tenant boundaries and explicit channel permission denials", async () => { const { campaign } = await setup(); expect((await call("get", `/campaigns/${campaign.id}`, undefined, "other-organization")).status).toBe(404); rows.userPermission.push({ userId: "synthetic-user", permission: "letters.view", granted: false }); expect((await call("get", `/campaigns/${campaign.id}`)).status).toBe(403); });
  it("never imports a clinical or foreign letter template", async () => { rows.letterTemplate.push({ id: "other", organizationId: "other-organization", crmScope: "DONOR" }); rows.letterTemplate.push({ id: "clinical", organizationId: org, crmScope: "EVENTS" }); for (const legacyId of ["other", "clinical"]) expect((await call("post", "/legacy/import", { channel: "LETTER", legacyId })).status).toBe(409); });
  it("validates saved-audience ownership before campaign creation", async () => { const result = await call("post", "/campaigns", { name: "Bad audience", channels: ["EMAIL"], audienceListIds: ["foreign-list"] }); expect(result.status).toBe(404); expect(rows.createCampaign).toHaveLength(0); });
  it("retains private and owner-only sharing restrictions after import", async () => {
    const email = await db.emailCampaign.create({ data: { organizationId: org, name: "Private draft", subject: "Private", templateJson: null, audienceFilter: JSON.stringify({ _sharing: { ownerId: "other-staff", sharedWithOrganization: false } }) } });
    expect((await call("post", "/legacy/import", { channel: "EMAIL", legacyId: email.id }, org, "staff")).status).toBe(403);
    const imported = await call("post", "/legacy/import", { channel: "EMAIL", legacyId: email.id }); expect(imported.status).toBe(201);
    expect((await call("get", `/campaigns/${imported.body.campaignId}`, undefined, org, "staff")).status).toBe(403);
    expect((await call("post", "/legacy/import", { channel: "EMAIL", legacyId: email.id }, org, "staff")).status).toBe(403);
    expect((await call("get", `/contents/${imported.body.contentId}/preview/EMAIL`, undefined, org, "staff")).status).toBe(403);
    rows.emailCampaign[0].audienceFilter = JSON.stringify({ _sharing: { ownerId: "other-staff", sharedWithOrganization: true } });
    expect((await call("get", `/campaigns/${imported.body.campaignId}`, undefined, org, "staff")).status).toBe(200);
    expect((await call("patch", `/contents/${imported.body.contentId}`, { name: "Disallowed edit", document: doc, revision: 1, campaignRevision: 1 }, org, "staff")).status).toBe(403);
  });
});
describe("linked drafts and approved releases", () => {
  it("releases only the formats included for each content piece",async()=>{
    const {campaign,content}=await setup(["EMAIL","WEB"]);await call("post",`/contents/${content.id}/native/EMAIL`,{campaignRevision:1});
    const originalWeb=rows.createVariant.find(row=>row.contentId===content.id&&row.channel==="WEB")!;
    expect((await call("patch",`/contents/${content.id}/variants/WEB`,{document:{...originalWeb.documentJson,enabled:false},revision:originalWeb.revision,campaignRevision:rows.createCampaign[0].revision})).status).toBe(200);
    const page=await call("post",`/campaigns/${campaign.id}/contents`,{name:"Dedicated public page",document:doc,campaignRevision:rows.createCampaign[0].revision});expect(page.status).toBe(201);
    const pageEmail=rows.createVariant.find(row=>row.contentId===page.body.id&&row.channel==="EMAIL")!;
    expect((await call("patch",`/contents/${page.body.id}/variants/EMAIL`,{document:{...pageEmail.documentJson,enabled:false},revision:pageEmail.revision,campaignRevision:rows.createCampaign[0].revision})).status).toBe(200);
    const review=await call("get",`/campaigns/${campaign.id}/readiness`);expect(review.status,JSON.stringify(review.body)).toBe(200);expect(review.body.eligibility.counts.EMAIL).toBe(1);
    const approved=await call("post",`/campaigns/${campaign.id}/approve`,{revision:rows.createCampaign[0].revision,confirm:true});expect(approved.status,JSON.stringify(approved.body)).toBe(201);
    expect(rows.createDelivery.map(row=>`${row.contentId}:${row.channel}`).sort()).toEqual([`${content.id}:EMAIL`,`${page.body.id}:WEB`].sort());
  });
  it("freezes independent channel dates, renews approval after a date edit, and clears dates on duplication", async () => {
    const { campaign, content } = await setup(["EMAIL", "WEB"]);
    rows.createContent[0].scheduledAt = new Date("2031-06-01T14:00:00.000Z");
    await call("post", `/contents/${content.id}/native/EMAIL`, { campaignRevision: 1 });
    const variant = rows.createVariant.find(row => row.channel === "EMAIL")!;
    const update = (scheduledAt: string) => call("patch", `/contents/${content.id}/variants/EMAIL`, { document: { ...variant.documentJson, scheduledAt }, revision: variant.revision, campaignRevision: rows.createCampaign[0].revision });
    expect((await update("2031-06-02T14:00:00.000Z")).status).toBe(200);
    const review = await call("get", `/campaigns/${campaign.id}/readiness`);
    expect(review.body.schedules).toEqual(expect.arrayContaining([expect.objectContaining({ channel: "WEB", scheduledAt: "2031-06-01T14:00:00.000Z" }), expect.objectContaining({ channel: "EMAIL", scheduledAt: "2031-06-02T14:00:00.000Z" })]));
    const approved = await call("post", `/campaigns/${campaign.id}/approve`, { confirm: true, revision: rows.createCampaign[0].revision });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect(rows.createDelivery.find(row => row.channel === "WEB")!.scheduledAt.toISOString()).toBe("2031-06-01T14:00:00.000Z");
    expect(rows.createDelivery.find(row => row.channel === "EMAIL")!.scheduledAt.toISOString()).toBe("2031-06-02T14:00:00.000Z");
    const frozen = structuredClone(rows.createRelease[0].snapshotJson);
    expect((await update("2031-06-03T14:00:00.000Z")).status).toBe(200);
    expect(rows.createRelease[0].status).toBe("SUPERSEDED"); expect(rows.createRelease[0].snapshotJson).toEqual(frozen); expect(rows.createDelivery.every(row => row.status === "CANCELLED")).toBe(true);
    const duplicate = await call("post", `/campaigns/${campaign.id}/duplicate`, { name: "New execution" }); expect(duplicate.status).toBe(201);
    const nextContent = rows.createContent.find(row => row.campaignId === duplicate.body.id)!;
    expect(nextContent.scheduledAt).toBeNull(); expect(rows.createVariant.filter(row => row.contentId === nextContent.id).every(row => row.documentJson.scheduledAt === null)).toBe(true);
  });
  it("includes a format-only date in the calendar without inventing a shared date", async () => {
    const { content } = await setup(["WEB"]);
    const updated = await call("patch", `/contents/${content.id}/variants/WEB`, { document: { ...rows.createVariant[0].documentJson, scheduledAt: "2031-06-04T14:00:00.000Z" }, revision: 1, campaignRevision: 1 }); expect(updated.status).toBe(200);
    const calendar = await call("get", "/calendar"); expect(calendar.status).toBe(200); expect(calendar.body.items).toEqual([expect.objectContaining({ contentId: content.id, channel: "WEB", scheduledAt: "2031-06-04T14:00:00.000Z" })]); expect(rows.createContent[0].scheduledAt).toBeNull();
  });
  it("finds an older scheduled item behind 500 newer undated drafts", async () => {
    const { campaign, content } = await setup(["WEB"]); rows.createContent[0].updatedAt = new Date("2020-01-01"); rows.createVariant[0].documentJson.scheduledAt = "2031-06-04T14:00:00.000Z";
    await db.createContent.createMany({ data: Array.from({ length: 500 }, (_, index) => ({ id: `a-${String(index).padStart(5, "0")}`, organizationId: org, campaignId: campaign.id, name: "Undated synthetic draft", documentJson: doc })) });
    const response = await call("get", "/calendar"); expect(response.status).toBe(200); expect(response.body.items.map((item: { contentId: string }) => item.contentId)).toEqual([content.id]); expect(response.body.hasMore).toBe(false);
  });
  it("discloses a bounded calendar scan and resumes without dropping the next scheduled item", async () => {
    const { campaign, content } = await setup(["WEB"]); rows.createVariant[0].documentJson.scheduledAt = "2031-06-04T14:00:00.000Z";
    await db.createContent.createMany({ data: Array.from({ length: 1001 }, (_, index) => ({ id: `a-${String(index).padStart(5, "0")}`, organizationId: org, campaignId: campaign.id, name: "Undated synthetic draft", documentJson: doc })) });
    const first = await call("get", "/calendar"); expect(first.body.items).toEqual([]); expect(first.body.hasMore).toBe(true); expect(first.body.nextCursor).toBeTruthy();
    const next = await call("get", `/calendar?after=${encodeURIComponent(first.body.nextCursor)}`); expect(next.body.items.map((item: { contentId: string }) => item.contentId)).toEqual([content.id]); expect(next.body.hasMore).toBe(false);
  });
  it("retains a local losing revision by refusing stale content writes", async () => { const { campaign, content } = await setup(["WEB"]); const payload = { name: content.name, document: doc, revision: 1, campaignRevision: campaign.revision }; expect((await call("patch", `/contents/${content.id}`, payload)).status).toBe(200); const stale = await call("patch", `/contents/${content.id}`, { ...payload, document: { ...doc, blocks: [] } }); expect(stale.status).toBe(409); expect(rows.createContent[0].documentJson).toEqual(doc); expect(rows.createDocumentRevision).toHaveLength(1); });
  it("preserves a customized letter paragraph when shared copy changes", async () => { const { campaign, content } = await setup(); const letter = rows.createVariant.find(row => row.channel === "LETTER")!; letter.documentJson.overrides.copy = "Customized postal copy"; const changed = await call("patch", `/contents/${content.id}`, { name: content.name, document: { ...doc, blocks: [{ ...doc.blocks[0], text: "Updated shared paragraph" }] }, revision: 1, campaignRevision: campaign.revision }); expect(changed.status).toBe(200); expect(letter.documentJson.overrides.copy).toBe("Customized postal copy"); expect(letter.needsReview).toBe(true); expect(rows.createDocumentRevision[0].documentJson.blocks[0].text).toBe("Updated shared paragraph"); });
  it("only replaces custom copy after the explicit shared-copy review choice", async () => { const { content } = await setup(["LETTER"]); const variant = rows.createVariant[0]; variant.documentJson.overrides.copy = "Custom letter"; variant.needsReview = true; expect((await call("post", `/contents/${content.id}/review/LETTER`, { choice: "SYNC_SHARED", campaignRevision: 1, variantRevision: 1 })).status).toBe(200); expect(rows.createVariant[0].documentJson.overrides).toEqual({}); expect(rows.letterTemplate[0].printBody).toContain("Synthetic shared appeal"); expect(rows.letterTemplate[0].printBody).not.toContain("Custom letter"); });
  it("materializes linked native email and letter layouts without sending", async () => { const { campaign, content } = await setup(); const email = await call("post", `/contents/${content.id}/native/EMAIL`, { campaignRevision: campaign.revision }); expect(email.status).toBe(200); const letter = await call("post", `/contents/${content.id}/native/LETTER`, { campaignRevision: campaign.revision + 1 }); expect(letter.status).toBe(200); expect(rows.emailCampaign).toHaveLength(1); expect(rows.letterTemplate).toHaveLength(1); expect(rows.emailCampaign[0].bodyHtml).toContain("Synthetic shared appeal"); expect(rows.letterTemplate[0].printBody).toContain("Synthetic shared appeal"); expect(rows.createDelivery).toHaveLength(0); });
  it("requires an explicit both-format strategy before review", async () => { const { campaign } = await setup(["EMAIL", "LETTER"], null); const response = await call("get", `/campaigns/${campaign.id}/readiness`); expect(response.status).toBe(400); expect(response.body.error.message).toContain("Choose email first"); });
  it("approves one immutable release per revision and holds every delivery", async () => { const { campaign, content } = await setup(["EMAIL"]); expect((await call("post", `/contents/${content.id}/native/EMAIL`, { campaignRevision: 1 })).status).toBe(200); const payload = { confirm: true, revision: 2 }; const approved = await call("post", `/campaigns/${campaign.id}/approve`, payload); expect(approved.status, JSON.stringify(approved.body)).toBe(201); expect(rows.createDelivery).toHaveLength(1); expect(rows.createDelivery[0].status).toBe("HELD"); const again = await call("post", `/campaigns/${campaign.id}/approve`, payload); expect(again.status).toBe(201); expect(again.body.id).toBe(approved.body.id); expect(rows.createRelease).toHaveLength(1); expect(rows.createDelivery).toHaveLength(1); });
  it("supersedes approval and cancels pending jobs after an edit", async () => { const { campaign, content } = await setup(["WEB"]); const approved = await call("post", `/campaigns/${campaign.id}/approve`, { confirm: true, revision: 1 }); expect(approved.status, JSON.stringify(approved.body)).toBe(201); expect((await call("post", `/releases/${approved.body.id}/release`, { confirm: true })).status).toBe(200); expect(rows.createDelivery[0].status).toBe("PENDING"); const frozen = structuredClone(rows.createRelease[0].snapshotJson); expect((await call("patch", `/contents/${content.id}`, { name: content.name, document: { version: 1, blocks: [] }, revision: 1, campaignRevision: 1 })).status).toBe(200); expect(rows.createRelease[0].status).toBe("SUPERSEDED"); expect(rows.createRelease[0].snapshotJson).toEqual(frozen); expect(rows.createDelivery[0].status).toBe("CANCELLED"); });
  it("invalidates pending releases after native legacy edits", async () => { const { campaign, content } = await setup(["EMAIL"]); await call("post", `/contents/${content.id}/native/EMAIL`, { campaignRevision: 1 }); const approved = await call("post", `/campaigns/${campaign.id}/approve`, { confirm: true, revision: 2 }); expect(approved.status).toBe(201); await invalidateLegacyBindings(org, "EMAIL", rows.emailCampaign[0].id); expect(rows.createCampaign[0].revision).toBe(3); expect(rows.createVariant[0].needsReview).toBe(true); expect(rows.createDelivery[0].status).toBe("CANCELLED"); });
  it("holds live delivery behind the organization flag", async () => { const { campaign } = await setup(["WEB"]); const approved = await call("post", `/campaigns/${campaign.id}/approve`, { confirm: true, revision: 1 }); rows.organizationSettings[0].oyamaCreateEnabled = false; expect((await call("post", `/releases/${approved.body.id}/release`, { confirm: true })).status).toBe(422); expect(rows.createDelivery[0].status).toBe("HELD"); });
  it("preserves historical email content and imports it idempotently", async () => { const source = await db.emailCampaign.create({ data: { organizationId: org, name: "Sent source", subject: "Original subject", bodyHtml: "<p>Original sent copy</p>", bodyText: "Original sent copy", templateJson: null, status: "SENT", sentAt: new Date(), totalRecipients: 1 } }); const snapshot = structuredClone(rows.emailCampaign[0]); const body = { channel: "EMAIL", legacyId: source.id }; const first = await call("post", "/legacy/import", body), second = await call("post", "/legacy/import", body); expect(first.status).toBe(201); expect(second.body.campaignId).toBe(first.body.campaignId); expect(rows.createCampaign[0].status).toBe("HISTORICAL"); expect(rows.emailCampaign[0]).toEqual(snapshot); expect(rows.createCampaign).toHaveLength(1); });
});
describe("durable channel worker", () => {
  it("preserves canonical private ownership on generated email executions", async () => {
    const source = await db.emailCampaign.create({ data: { organizationId: org, name: "Private campaign", subject: "Private message", bodyHtml: "<p>Private test copy</p>", bodyText: "Private test copy", templateJson: JSON.stringify({ sharedWithOrganization: true }), audienceFilter: JSON.stringify({ recipientListId: "audience", _sharing: { ownerId: "source-owner", sharedWithOrganization: false } }) } });
    const imported = await call("post", "/legacy/import", { channel: "EMAIL", legacyId: source.id }); expect(imported.status).toBe(201);
    expect(rows.createCampaign[0].isTemplate).toBe(false); expect(rows.createCampaign[0].audienceListIds).toEqual(["audience"]);
    const approval = await call("post", `/campaigns/${imported.body.campaignId}/approve`, { confirm: true, revision: 1 }); expect(approval.status, JSON.stringify(approval.body)).toBe(201);
    await call("post", `/releases/${approval.body.id}/release`, { confirm: true }); await processCreateQueue();
    const execution = rows.emailCampaign.find(row => row.id !== source.id)!;
    expect(JSON.parse(execution.audienceFilter)._sharing).toEqual({ ownerId: "source-owner", sharedWithOrganization: false });
  });
  async function releasedSocial() {
    const { campaign } = await setup(["SOCIAL"]);
    rows.createVariant[0].documentJson = variantFrom({ accountId: "12345", caption: "Synthetic post", network: "FACEBOOK" });
    await db.createConnection.create({ data: { organizationId: org, provider: "META", readyAt: new Date(), configJson: { apiVersion: "v25.0", accounts: [{ id: "12345", name: "Synthetic Page" }] }, secret: encryptCredential(JSON.stringify({ userToken: "synthetic", pageTokens: { "12345": "synthetic" } })), webhookSecret: "unused" } });
    const approved = await call("post", `/campaigns/${campaign.id}/approve`, { revision: 1, confirm: true }); expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect((await call("post", `/releases/${approved.body.id}/release`, { confirm: true })).status).toBe(200);
  }
  it("does not start paused or cancelled work", async () => { await releasedSocial(); rows.createDelivery[0].status = "PAUSED"; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); expect(await processCreateQueue()).toBe(0); expect(fetch).not.toHaveBeenCalled(); });
  it("treats an incomplete successful provider response as ambiguous", async () => { await releasedSocial(); vi.stubGlobal("fetch", vi.fn(async () => new Response("{incomplete", { status: 200 }))); await processCreateQueue(); expect(rows.createDelivery[0].status).toBe("UNKNOWN"); expect((await call("post", `/deliveries/${rows.createDelivery[0].id}/retry`, { confirm: true })).status).toBe(409); });
  it("does not permit blind retries after a provider success and local write failure", async () => { await releasedSocial(); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "provider-post-id" }), { status: 200 }))); const update = vi.spyOn(db.createDelivery, "update").mockRejectedValueOnce(new Error("Synthetic post-success persistence failure")); await processCreateQueue(); expect(rows.createDelivery[0].status).toBe("UNKNOWN"); update.mockRestore(); });
  it("keeps channel failures independent of other pending channels", async () => { await releasedSocial(); await db.createDelivery.create({ data: { organizationId: org, releaseId: rows.createRelease[0].id, contentId: rows.createContent[0].id, channel: "EMAIL", deliveryKey: "independent-held", recipientKey: "other@example.invalid", scheduledAt: new Date(), status: "HELD" } }); vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Synthetic authorization rejection" }), { status: 403 }))); await processCreateQueue(); expect(rows.createDelivery[0].status).toBe("FAILED"); expect(rows.createDelivery[1].status).toBe("HELD"); });
  it("rechecks SMS consent after approval before calling Azure", async () => {
    const { campaign } = await setup(["SMS"]);
    await db.createConnection.create({ data: { organizationId: org, provider: "AZURE_SMS", readyAt: new Date(), configJson: { endpoint: "https://synthetic.communication.azure.com", sender: "+15555550999" }, secret: encryptCredential(Buffer.from("synthetic-key").toString("base64")), webhookSecret: "unused" } });
    await db.createSmsConsent.create({ data: { organizationId: org, phone: "+15555550101", status: "OPTED_IN", source: "test", evidence: "Synthetic consent", occurredAt: new Date() } });
    const approved = await call("post", `/campaigns/${campaign.id}/approve`, { revision: 1, confirm: true }); expect(approved.status).toBe(201);
    await call("post", `/releases/${approved.body.id}/release`, { confirm: true }); rows.createSmsConsent[0].status = "OPTED_OUT";
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); await processCreateQueue(); expect(rows.createDelivery[0].status).toBe("SUPPRESSED"); expect(fetch).not.toHaveBeenCalled();
  });
});
describe("public forms", () => {
  it("holds explicit consent submissions for review without changing contacts", async () => {
    await db.createPublication.create({ data: { organizationId: org, campaignId: "campaign", contentId: "content", slug: "synthetic-public", active: true, documentJson: doc, variantJson: variantFrom({ formEnabled: true, consentText: "Synthetic explicit consent wording" }) } });
    const payload = { name: "Synthetic Visitor", email: "visitor@example.invalid", message: "Synthetic request", consent: true };
    const before = structuredClone(rows.constituent);
    expect((await request(app).post("/api/oyama-create/public/pages/synthetic-public/submissions").send({ ...payload, consent: false })).status).toBe(400);
    expect((await request(app).post("/api/oyama-create/public/pages/synthetic-public/submissions").send(payload)).status).toBe(202);
    expect(rows.createLead[0].consentText).toBe("Synthetic explicit consent wording"); expect(rows.createLead[0].status).toBe("PENDING"); expect(rows.constituent).toEqual(before);
  });
});
describe("Azure Event Grid consent and delivery events", () => {
  async function connection() { return db.createConnection.create({ data: { organizationId: org, provider: "AZURE_SMS", configJson: { sender: "+15555550999", topic: "/subscriptions/s/resourceGroups/r/providers/Microsoft.Communication/communicationServices/synthetic", eventGridVerified: true }, secret: encryptCredential("synthetic"), webhookSecret: encryptCredential("synthetic-webhook-key") } }); }
  const post = (id: string, body: unknown, key = "synthetic-webhook-key") => request(app).post(`/api/oyama-create/webhooks/azure/${id}`).set("x-oyama-webhook-key", key).send(body as object);
  it("authenticates callbacks and validates the organization resource topic", async () => { const conn = await connection(); expect((await post(conn.id, [], "wrong")).status).toBe(401); expect((await post(conn.id, [{ id: "event", eventType: "Microsoft.Communication.SMSReceived", topic: "foreign-resource", data: {} }])).status).toBe(403); });
  it("deduplicates STOP callbacks and suppresses approved pending SMS", async () => { const conn = await connection(); await db.createSmsConsent.create({ data: { organizationId: org, phone: "+15555550101", status: "OPTED_IN", occurredAt: new Date("2026-01-01"), evidence: "Synthetic fixture", source: "test" } }); await db.createDelivery.create({ data: { organizationId: org, releaseId: "release", channel: "SMS", contentId: "content", recipientKey: "+15555550101", status: "PENDING", deliveryKey: "unique-sms" } }); const event = [{ id: "stop-event", topic: conn.configJson.topic, eventType: "Microsoft.Communication.SMSReceived", eventTime: "2026-11-03T12:00:00Z", data: { from: "+15555550101", to: "+15555550999", message: "STOP" } }]; expect((await post(conn.id, event)).status).toBe(200); expect((await post(conn.id, event)).status).toBe(200); expect(rows.createSmsConsent[0].status).toBe("OPTED_OUT"); expect(rows.createDelivery[0].status).toBe("SUPPRESSED"); expect(rows.createWebhookEvent).toHaveLength(1); });
  it("accepts a delivery report before acceptance and ignores late contradictory duplicates", async () => { const conn = await connection(); const delivery = await db.createDelivery.create({ data: { organizationId: org, releaseId: "release", channel: "SMS", contentId: "content", recipientKey: "+15555550101", status: "SENDING", deliveryKey: "sms-key" } }); const event = { id: "delivered-event", topic: conn.configJson.topic, eventType: "Microsoft.Communication.SMSDeliveryReportReceived", eventTime: "2026-11-03T12:01:00Z", data: { to: "+15555550101", messageId: "provider-id", Tag: delivery.id, deliveryStatus: "Delivered" } }; expect((await post(conn.id, [event])).status).toBe(200); expect(rows.createDelivery[0].status).toBe("DELIVERED"); expect((await post(conn.id, [{ ...event, id: "late-failure", data: { ...event.data, deliveryStatus: "Failed" } }])).status).toBe(200); expect(rows.createDelivery[0].status).toBe("DELIVERED"); });
});
