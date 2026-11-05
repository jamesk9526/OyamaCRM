/** Synthetic persistence; real OAuth, MCP and Create handlers. No real donor data or OpenAI calls. */
import express from "express";
import { unlink } from "node:fs/promises";
import { encode as encodePng } from "fast-png";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
const reporting = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock("@/server/src/services/donor-report-library", async importOriginal => ({ ...await importOriginal<object>(), buildDonorLibraryReport: reporting.build }));
import router, { authorizationMetadata, chatGptRateLimiter, discoveryRouter } from "@/server/src/chatgpt/routes";
import { authorizationInput, connectionConfig, hashToken } from "@/server/src/chatgpt/config";
import { signAccessToken } from "@/server/src/lib/auth";
import { defaultDesign } from "@/server/src/oyama-create/studio/design";
import { normalizeBrand } from "@/server/src/oyama-create/studio/brand";
import { freezeStudioPrint } from "@/server/src/oyama-create/studio/print";
import { emptyDonor } from "@/server/src/oyama-create/studio/render";
import { checkChatGptConnection } from "../../scripts/chatgpt-check.mjs";
import { DEFAULT_MCP_POLICY, MCP_POLICY_KEY } from "@/server/src/chatgpt/policy";
import { DAILY_IMAGE_LIMIT, processLetterImageQueue } from "@/server/src/chatgpt/letter-images";
import { managedPublicMedia } from "@/server/src/lib/public-media";
const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use("/api/chatgpt", router);
app.use(discoveryRouter);
app.use((e: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { void _next; res.status(500).json({ error: e.message }); });
const root = "/api/chatgpt", origin = "https://crm.example.org", redirect = "https://chatgpt.com/connector_platform/oauth/callback", resource = `${origin}${root}/mcp`;
const verifier = "a".repeat(43), challenge = Buffer.from(hashToken(verifier), "hex").toString("base64url");
const identity = (id = "staff", orgId = "org") => signAccessToken({ sub: id, orgId, role: "admin", email: `${id}@example.invalid` });
const input = (scope = "letters.read letters.write reports.read") => ({ response_type: "code", client_id: "oyama-chatgpt", redirect_uri: redirect, resource, code_challenge: challenge, code_challenge_method: "S256", scope, state: "synthetic-state" });
async function consent(overrides = {}) { return request(app).post(`${root}/oauth/consent`).set("Authorization", `Bearer ${identity()}`).send({ ...input(), approved: true, ...overrides }); }
async function exchange(code: string, overrides = {}) { return request(app).post(`${root}/oauth/token`).type("form").send({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: "oyama-chatgpt", redirect_uri: redirect, resource, ...overrides }); }
async function tokens(scope?: string) { const result = await consent(scope ? { scope } : {}); expect(result.status, JSON.stringify(result.body)).toBe(200); const code = new URL(result.body.redirectUrl).searchParams.get("code")!; const response = await exchange(code); expect(response.status, JSON.stringify(response.body)).toBe(200); return response.body; }
async function rpc(token: string, method: string, params?: unknown) { return request(app).post(`${root}/mcp`).set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method, params }); }
const tool = (token: string, name: string, args: object = {}) => rpc(token, "tools/call", { name, arguments: args });
const resultOf = (response: { body: { result: { content: { text: string }[] } } }) => JSON.parse(response.body.result.content[0].text);
const png = encodePng({ width: 2, height: 2, channels: 3, data: Uint8Array.from([30, 90, 160, 80, 140, 210, 80, 140, 210, 30, 90, 160]) });
// Synthetic 2 × 2 JPEG returned by the mocked image provider.
const jpegBase64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD8qqKKKAP/2Q==";
beforeEach(async () => {
  chatGptRateLimiter.resetKey("::ffff:127.0.0.1"); chatGptRateLimiter.resetKey("127.0.0.1");
  resetCreateRows(); vi.unstubAllGlobals(); vi.stubEnv("CHATGPT_FORCE_DISABLED", ""); vi.stubEnv("CHATGPT_ENABLED", "true"); vi.stubEnv("CHATGPT_PUBLIC_URL", origin); vi.stubEnv("CHATGPT_REDIRECT_URIS", redirect); vi.stubEnv("CHATGPT_IMAGE_API_KEY", "");
  await db.user.create({ data: { id: "staff", organizationId: "org", active: true, role: "admin", email: "staff@example.invalid" } });
  await db.user.create({ data: { id: "other", organizationId: "other-org", active: true, role: "admin", email: "other@example.invalid" } });
  await db.organizationSettings.create({ data: { organizationId: "org", oyamaCreateEnabled: true, oyamaCreateStudioEnabled: true, fiscalYearStart: 7 } });
  await db.createBrandRevision.create({ data: { id: "brand", organizationId: "org", revision: 1, documentJson: { version: 1, identity: { organizationDisplayName: "Synthetic nonprofit" }, profiles: [], presets: [], signers: [], defaultSignerId: null } } });
  await db.pluginSetting.create({ data: { organizationId: "org", pluginKey: MCP_POLICY_KEY, config: { revision: 1, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true, allowDateBasisOverride: true } } } });
  reporting.build.mockReset().mockResolvedValue({ report: "campaign-performance", title: "Synthetic aggregate report", rows: [{ campaign: "Synthetic appeal", totalAmount: 123.45 }], columns: [{ key: "totalAmount", type: "currency" }], audienceConstituentIds: ["private-donor"], notices: [] });
});
afterEach(async () => {
  for (const asset of rows.createStudioAsset) {
    const media = managedPublicMedia(asset.url);
    if (media?.namespace === "letter-media" && media.organizationId === "org" && /^[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(media.fileName)) await unlink(`public${media.storagePath}`);
  }
});
describe.sequential("ChatGPT account connection", () => {
  it("publishes discovery and rejects missing credentials", async () => {
    expect(authorizationMetadata()).toMatchObject({ issuer: origin, token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"] });
    expect((await request(app).get(`${root}/resource-metadata`)).body.resource).toBe(resource);
    const response = await request(app).post(`${root}/mcp`).send({}); expect(response.status).toBe(401); expect(response.headers["www-authenticate"]).toContain("resource_metadata="); expect(response.headers["www-authenticate"]).not.toContain('scope="letters.read reports.read"');
    const previous = process.env.NODE_ENV;
    try { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CHATGPT_PUBLIC_URL", ""); vi.stubEnv("NEXT_PUBLIC_APP_URL", ""); vi.stubEnv("FRONTEND_ORIGIN", ""); expect(connectionConfig().enabled).toBe(false); }
    finally { vi.stubEnv("NODE_ENV", previous); }
  });
  it("validates exact callback, audience, scopes and PKCE before redirecting", async () => {
    for (const bad of [{ redirect_uri: "https://evil.invalid" }, { resource: "https://evil.invalid" }, { scope: "admin" }, { code_challenge_method: "plain" }, { client_id: "evil" }]) expect(() => authorizationInput({ ...input(), ...bad })).toThrow();
    const response = await request(app).get(`${root}/oauth/authorize`).query(input()); expect(response.status).toBe(302); expect(response.headers.location).toContain(`${origin}/connect/chatgpt?`);
  });
  it("requires a CRM login and honors cancellation without creating a credential", async () => {
    expect((await request(app).post(`${root}/oauth/consent`).send({ ...input(), approved: true })).status).toBe(401);
    const denied = await consent({ approved: false }); expect(new URL(denied.body.redirectUrl).searchParams.get("error")).toBe("access_denied"); expect(rows.chatGptGrant).toHaveLength(0);
  });
  it("uses hashed single-use codes, validates verifier and never accepts CRM tokens at MCP", async () => {
    const approved = await consent(); const callback = new URL(approved.body.redirectUrl), code = callback.searchParams.get("code")!;
    expect(callback.searchParams.get("state")).toBe("synthetic-state"); expect(rows.chatGptGrant[0].codeHash).toBe(hashToken(code));
    expect((await exchange(code, { code_verifier: "b".repeat(43) })).body.error).toBe("invalid_grant");
    const response = await exchange(code); expect(response.status).toBe(200); expect(rows.chatGptGrant[0].accessHash).toBe(hashToken(response.body.access_token));
    expect((await exchange(code)).body.error).toBe("invalid_grant"); expect((await rpc(identity(), "tools/list")).status).toBe(401);
  });
  it("rotates refresh tokens and rejects previous tokens, wrong resources and revoked sessions", async () => {
    const t = await tokens();
    const refreshBody = { grant_type: "refresh_token", client_id: "oyama-chatgpt", resource, refresh_token: t.refresh_token };
    expect((await request(app).post(`${root}/oauth/token`).send({ ...refreshBody, resource: "https://evil.invalid" })).status).toBe(400);
    const fresh = await request(app).post(`${root}/oauth/token`).send(refreshBody); expect(fresh.status).toBe(200);
    expect((await request(app).post(`${root}/oauth/token`).send(refreshBody)).status).toBe(400);
    expect((await rpc(t.access_token, "tools/list")).status).toBe(401);
    expect((await request(app).delete(`${root}/connections/${rows.chatGptGrant[0].id}`).set("Authorization", `Bearer ${identity("other", "other-org")}`)).status).toBe(204);
    expect((await rpc(fresh.body.access_token, "tools/list")).status).toBe(200);
    await request(app).post(`${root}/oauth/revoke`).send({ client_id: "oyama-chatgpt", token: fresh.body.refresh_token });
    expect((await rpc(fresh.body.access_token, "tools/list")).status).toBe(401);
  });
  it("negotiates MCP, filters tools by consent, handles notifications and limits methods", async () => {
    const t = await tokens("reports.read");
    expect((await rpc(t.access_token, "initialize", { protocolVersion: "2025-06-18" })).body.result.protocolVersion).toBe("2025-06-18");
    expect((await rpc(t.access_token, "initialize", { protocolVersion: "2099-01-01" })).body.result.protocolVersion).toBe("2025-11-25");
    expect((await rpc(t.access_token, "tools/list")).body.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["list_reports", "get_reporting_context", "run_report"]);
    expect((await rpc(t.access_token, "tools/call", { name: "read_letter", arguments: { id: "x", kind: "LEGACY" } })).body.error.code).toBe(-32602);
    expect((await request(app).post(`${root}/mcp`).set("Authorization", `Bearer ${t.access_token}`).send({ jsonrpc: "2.0", method: "notifications/initialized" })).status).toBe(202);
    expect((await request(app).get(`${root}/mcp`).set("Authorization", `Bearer ${t.access_token}`)).status).toBe(405);
  });
  it("rechecks active membership and explicit permission denials on every tool call", async () => {
    const t = await tokens("reports.read");
    await db.userPermission.create({ data: { userId: "staff", permission: "view:reports", granted: false } });
    const denied = await rpc(t.access_token, "tools/call", { name: "list_reports", arguments: {} }); expect(denied.body.result.isError).toBe(true);
    await db.user.update({ where: { id: "staff" }, data: { active: false } }); expect((await rpc(t.access_token, "tools/list")).status).toBe(401);
  });
  it("runs bounded aggregate reports with correct years and strips donor identifiers", async () => {
    const t = await tokens("reports.read");
    const response = await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "campaign-performance", year: 2024 } });
    const result = resultOf(response); expect(result.rows[0].totalAmount).toBe(123.45); expect(result.audienceConstituentIds).toBeUndefined();
    const [org, key, options] = reporting.build.mock.calls[0]; expect(org).toBe("org"); expect(key).toBe("campaign-performance"); expect(options.from.getFullYear()).toBe(2024); expect(options.from.getMonth()).toBe(0); expect(options.through.getFullYear()).toBe(2024);
    const invalid = await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "donor-notes" } }); expect(invalid.body.result.isError).toBe(true);
  });
  it("isolates legacy letters to donor CRM and organization", async () => {
    const t = await tokens("letters.read");
    await db.letterTemplate.create({ data: { id: "foreign", organizationId: "other-org", printBody: "PRIVATE" } });
    await db.letterTemplate.create({ data: { id: "clinical", organizationId: "org", crmScope: "COMPASSION", printBody: "CLINICAL" } });
    await db.letterTemplate.create({ data: { id: "letter", organizationId: "org", name: "Synthetic letter", printBody: "Dear {{name}}" } });
    for (const id of ["foreign", "clinical"]) expect((await rpc(t.access_token, "tools/call", { name: "read_letter", arguments: { id, kind: "LEGACY" } })).body.result.isError).toBe(true);
    const response = resultOf(await rpc(t.access_token, "tools/call", { name: "read_letter", arguments: { id: "letter", kind: "LEGACY" } })); expect(response.printBody).toContain("{{name}}");
  });
  it("creates editable, sanitized draft copies with pinned branding and retry receipts", async () => {
    const t = await tokens("letters.write");
    const args = { name: "Synthetic ChatGPT appeal", html: "<h1>Help today</h1><p>Dear {{name}}</p><script>alert(1)</script>", requestKey: "synthetic-request" };
    const first = await rpc(t.access_token, "tools/call", { name: "create_letter_draft", arguments: args }); expect(first.body.result.isError, JSON.stringify(first.body)).not.toBe(true);
    const result = resultOf(first); expect(result.status).toBe("DRAFT"); expect(result.reviewRequired).toBe(true);
    const replay = resultOf(await rpc(t.access_token, "tools/call", { name: "create_letter_draft", arguments: args })); expect(replay.id).toBe(result.id); expect(rows.createContent).toHaveLength(1);
    expect(JSON.stringify(rows.createContent[0].designJson)).not.toContain("<script>"); expect(rows.createContent[0].designJson.brandRevisionId).toBe("brand"); expect(rows.createDocumentRevision[0].documentJson.studio).toBeTruthy(); expect(rows.createDelivery).toHaveLength(0); expect(rows.createRelease).toHaveLength(0);
    const conflict = await rpc(t.access_token, "tools/call", { name: "create_letter_draft", arguments: { ...args, html: "<p>Different</p>" } }); expect(conflict.body.result.isError).toBe(true);
  });
  it("authors and previews a branded merge letter even when both Create rollout switches are off", async () => {
    await db.organizationSettings.update({ where: { organizationId: "org" }, data: { oyamaCreateEnabled: false, oyamaCreateStudioEnabled: false } });
    const { access_token: token } = await tokens("letters.read letters.write");
    const options = resultOf(await tool(token, "get_letter_design_options"));
    expect(options.inlineMergeTokens).toContain("{{donor.salutation}}");
    expect(options.fieldBlocks).toContain("giving.total");
    const draft = resultOf(await tool(token, "create_letter_draft", {
      name: "Synthetic appeal", requestKey: "studio-layout-01", html: '<h1>Thank you</h1><p>Dear {{donor.salutation | fallback: "Friend"}},</p><p>[Date] · Unsupported {{donor.fakeField}}</p>',
      layout: { paper: "A4", orientation: "landscape", margins: { top: .75 }, font: "Inter", firstFooter: { mode: "none" }, replySlip: { enabled: true, placement: "separate", html: "<p>I would like to give.</p>" }, outerEnvelope: { enabled: true }, givingUrl: "/give/example" },
      insertBlocks: [{ type: "field", field: "giving.total", afterBlock: 2 }, { type: "giving_qr" }],
    }));
    expect(draft).toMatchObject({ revision: 1, status: "DRAFT", reviewRequired: true });
    const design = rows.createContent[0].designJson;
    expect(design).toMatchObject({ page: { paper: "A4", orientation: "landscape", margins: { top: .75 } }, styles: { font: "Inter" }, regions: { firstFooter: { mode: "none" } }, pack: { replySlip: { enabled: true }, outerEnvelope: { enabled: true } } });
    expect(design.body.content.map((item: { type: string }) => item.type)).toEqual(["heading", "paragraph", "studioField", "paragraph", "studioQr"]);
    const preview = resultOf(await tool(token, "preview_letter_draft", { id: draft.id, revision: 1 }));
    expect(preview.previewText).toContain("Dear Jordan,");
    expect(preview.previewText).toContain("$150.00");
    expect(preview.previewText).toContain("I would like to give.");
    expect(preview).toMatchObject({ sample: true, page: { paper: "A4" }, printPack: { replySlip: true, outerEnvelope: true }, url: draft.url });
    expect(preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MERGE_CONTEXT" })]));
    expect(preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "LITERAL_PLACEHOLDER", blocking: false })]));
    expect(rows.createRelease).toHaveLength(0);
    expect(rows.createDelivery).toHaveLength(0);
    expect(rows.organizationSettings[0]).toMatchObject({ oyamaCreateEnabled: false, oyamaCreateStudioEnabled: false });
  });
  it("revises only the owner's standalone MCP drafts and preserves prior document revisions", async () => {
    const first = await tokens("letters.write");
    const draft = resultOf(await tool(first.access_token, "create_letter_draft", { name: "Original", html: "<p>Original text</p>", requestKey: "original-draft" }));
    const second = await tokens("letters.read letters.write");
    const token = second.access_token;
    const change = { id: draft.id, revision: 1, requestKey: "revise-layout", layout: { paper: "LEGAL", margins: { top: .5 } }, insertBlocks: [{ type: "page_break", afterBlock: 1 }, { type: "salutation", afterBlock: 1 }] };
    const edited = resultOf(await tool(token, "update_letter_draft", change));
    expect(edited.revision).toBe(2);
    expect(resultOf(await tool(token, "update_letter_draft", change))).toEqual(edited);
    expect((await tool(token, "update_letter_draft", { ...change, requestKey: "stale-revision" })).body.result.isError).toBe(true);
    expect(rows.createDocumentRevision.map(row => row.revision)).toEqual([1, 2]);
    expect(rows.createDocumentRevision[0].documentJson.studio.page.paper).toBe("LETTER");
    expect(rows.createDocumentRevision[1].documentJson.studio.body.content[0].content[0].text).toBe("Original text");
    await db.createRelease.create({ data: { organizationId: "org", campaignId: draft.campaignId, campaignRevision: 1, status: "SUPERSEDED" } });
    expect((await tool(token, "update_letter_draft", { ...change, revision: 2, requestKey: "with-release" })).body.result.isError).toBe(true);
    expect(rows.createRelease[0].status).toBe("SUPERSEDED");
    const manual = await db.createCampaign.create({ data: { organizationId: "org", ownerId: "staff", name: "Manual", channelsJson: ["LETTER"] } });
    const content = await db.createContent.create({ data: { organizationId: "org", campaignId: manual.id, name: "Manual", designJson: defaultDesign(), documentJson: {} } });
    await db.createVariant.create({ data: { organizationId: "org", contentId: content.id, channel: "LETTER" } });
    expect((await tool(token, "update_letter_draft", { ...change, id: content.id, requestKey: "manual-draft" })).body.result.isError).toBe(true);
    expect((await tool(token, "update_letter_draft", { ...change, requestKey: "bad-layout", layout: { margins: { top: -1 } } })).body.result.isError).toBe(true);
    expect(rows.createDocumentRevision).toHaveLength(2);
  });
  it("imports ChatGPT attachments, lists owned assets and inserts an editable image block", async () => {
    const { access_token: token } = await tokens("letters.read letters.write");
    const fetchImage = vi.fn(async () => new Response(Buffer.from(png), { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchImage);
    const metadata = (await rpc(token, "tools/list")).body.result.tools;
    expect(metadata.find((item: { name: string }) => item.name === "import_letter_image")._meta["openai/fileParams"]).toEqual(["file"]);
    const args = { name: "Synthetic photo", requestKey: "import-artwork", file: { download_url: "https://files.oaiusercontent.com/file.png?sig=fixture", file_id: "fixture-image", mime_type: "image/png" } };
    const image = resultOf(await tool(token, "import_letter_image", args));
    expect(image).toMatchObject({ width: 2, height: 2, mimeType: "image/png" });
    expect(resultOf(await tool(token, "import_letter_image", { ...args, file: { ...args.file, download_url: "https://files.oaiusercontent.com/file.png?sig=fresh" } }))).toEqual(image);
    expect((await tool(token, "import_letter_image", { ...args, requestKey: "foreign-source", file: { ...args.file, download_url: "https://evil-oaiusercontent.com/file.png" } })).body.result.isError).toBe(true);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(resultOf(await tool(token, "list_letter_images", { query: "Synthetic" })).items).toEqual([image]);
    const draft = resultOf(await tool(token, "create_letter_draft", { name: "Illustrated", html: "<p>Dear {{donor.firstName}}</p>", requestKey: "illustrated-draft" }));
    const inserted = { id: draft.id, revision: draft.revision, requestKey: "insert-image", insertBlocks: [{ type: "image", assetId: image.assetId, alt: "A synthetic two-tone pattern", caption: "Illustration", align: "right", widthPercent: 45, afterBlock: 0 }] };
    const edited = resultOf(await tool(token, "update_letter_draft", inserted));
    expect(rows.createContent[0].designJson.body.content[0]).toMatchObject({ type: "image", attrs: { src: new URL(image.url).pathname, width: 45, textAlign: "right", caption: "Illustration" } });
    const preview = resultOf(await tool(token, "preview_letter_draft", { id: draft.id, revision: edited.revision }));
    expect(preview.issues).toEqual([]);
    expect(preview.previewText).toContain("Dear Jordan");
    await db.createTrashItem.create({ data: { organizationId: "org", kind: "ASSET", resourceId: image.assetId } });
    expect(resultOf(await tool(token, "list_letter_images")).items).toEqual([]);
    expect((await tool(token, "update_letter_draft", { ...inserted, revision: 2, requestKey: "trashed-asset" })).body.result.isError).toBe(true);
  });
  it("queues a single paid request per key and stores a ready-to-insert asset once", async () => {
    const { access_token: token } = await tokens("letters.read letters.write");
    const args = { name: "Synthetic generated art", requestKey: "generate-illustration", prompt: "A friendly watercolor illustration of a community garden", shape: "landscape" };
    expect((await tool(token, "generate_letter_image", args)).body.error.code).toBe(-32602);
    vi.stubEnv("CHATGPT_IMAGE_API_KEY", "synthetic-provider-key");
    expect((await tool(token, "generate_letter_image", args)).body.error.code).toBe(-32602);
    await db.pluginSetting.update({ where: { id: rows.pluginSetting[0].id }, data: { config: { revision: 2, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true, allowImageGeneration: true } } } });
    const fetchImage = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: [{ b64_json: jpegBase64 }] }));
    vi.stubGlobal("fetch", fetchImage);
    const queued = resultOf(await tool(token, "generate_letter_image", args));
    expect(queued.status).toBe("QUEUED");
    expect(resultOf(await tool(token, "generate_letter_image", args))).toEqual(queued);
    expect((await tool(token, "generate_letter_image", { ...args, prompt: "Another illustration" })).body.result.isError).toBe(true);
    expect(fetchImage).not.toHaveBeenCalled();
    await Promise.all([processLetterImageQueue(), processLetterImageQueue()]);
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(String(fetchImage.mock.calls[0][1]?.body))).toMatchObject({ prompt: args.prompt, size: "1536x1024", output_format: "jpeg", n: 1 });
    expect(rows.chatGptImageJob[0].prompt).toBeNull();
    const completed = resultOf(await tool(token, "get_letter_image_job", { id: queued.jobId }));
    expect(completed).toMatchObject({ status: "COMPLETED", image: { width: 2, height: 2, mimeType: "image/jpeg" } });
    expect(rows.createStudioAsset).toHaveLength(1);
    await tool(token, "create_letter_draft", {
      name: "Draft with generated artwork", html: "<p>Dear {{donor.salutation}}</p>", requestKey: "generated-image-draft",
      layout: { givingUrl: "https://example.invalid/give" },
      insertBlocks: [{ type: "image", assetId: completed.image.assetId, alt: "Synthetic artwork", align: "right", widthPercent: 40 }, { type: "giving_qr" }],
    });
    const design = rows.createContent[0].designJson;
    // Verify the effective LETTER body is used for the proof even with an independent channel document.
    design.channels.LETTER = { document: design.body, reviewedSource: null };
    design.body = { type: "doc", content: [] };
    const snapshot = await freezeStudioPrint("org", design, { ...emptyDonor(), salutation: "Jordan" }, normalizeBrand(rows.createBrandRevision[0].documentJson), "LETTER", true);
    expect(snapshot.html).toContain("width:40%;margin-left:auto;");
    expect(snapshot.html).toContain('alt="Scan to give"');
    expect(snapshot.assets[new URL(completed.image.url).pathname]).toBe(`data:image/jpeg;base64,${jpegBase64}`);
    expect(JSON.stringify(rows.auditLog)).not.toContain(args.prompt);
  });
  it("caps queue submissions and drops queued requests when draft permission is revoked", async () => {
    const { access_token: token } = await tokens("letters.write");
    vi.stubEnv("CHATGPT_IMAGE_API_KEY", "synthetic-provider-key");
    await db.pluginSetting.update({ where: { id: rows.pluginSetting[0].id }, data: { config: { revision: 2, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true, allowImageGeneration: true } } } });
    const args = { name: "Synthetic garden", prompt: "A garden" };
    for (let i = 0; i < DAILY_IMAGE_LIMIT; i++) expect(resultOf(await tool(token, "generate_letter_image", { ...args, requestKey: `daily-image-${i}` })).status).toBe("QUEUED");
    expect((await tool(token, "generate_letter_image", { ...args, requestKey: "over-daily-limit" })).body.result.content[0].text).toContain("for today");
    await db.userPermission.create({ data: { userId: "staff", permission: "letters.edit", granted: false } });
    const fetchImage = vi.fn(); vi.stubGlobal("fetch", fetchImage);
    await processLetterImageQueue();
    expect(fetchImage).not.toHaveBeenCalled();
    expect(rows.chatGptImageJob[0]).toMatchObject({ status: "FAILED", prompt: null });
  });
  it("keeps failed and interrupted generation requests from making another provider call", async () => {
    const { access_token: token } = await tokens("letters.write");
    vi.stubEnv("CHATGPT_IMAGE_API_KEY", "synthetic-provider-key");
    await db.pluginSetting.update({ where: { id: rows.pluginSetting[0].id }, data: { config: { revision: 2, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true, allowImageGeneration: true } } } });
    const args = { name: "Synthetic artwork", prompt: "A cheerful garden", requestKey: "failed-generation" };
    const fetchImage = vi.fn<typeof fetch>().mockImplementation(async () => new Response("Provider unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchImage);
    const queued = resultOf(await tool(token, "generate_letter_image", args));
    await processLetterImageQueue();
    expect(resultOf(await tool(token, "generate_letter_image", args))).toMatchObject({ jobId: queued.jobId, status: "FAILED" });
    await processLetterImageQueue();
    expect(fetchImage).toHaveBeenCalledTimes(1);
    const interrupted = resultOf(await tool(token, "generate_letter_image", { ...args, requestKey: "interrupted-generation" }));
    await db.chatGptImageJob.update({ where: { id: interrupted.jobId }, data: { status: "RUNNING", prompt: null, startedAt: new Date(Date.now() - 240_000) } });
    await processLetterImageQueue();
    expect(resultOf(await tool(token, "get_letter_image_job", { id: interrupted.jobId }))).toMatchObject({ status: "FAILED" });
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(rows.createStudioAsset).toHaveLength(0);
  });
  it("protects Create private imports and Trash during search and reading", async () => {
    const t = await tokens("letters.read");
    await db.user.update({ where: { id: "staff" }, data: { role: "staff" } });
    for (const id of ["visible", "private", "trashed"]) {
      await db.createCampaign.create({ data: { id, organizationId: "org", channelsJson: ["LETTER"] } });
      await db.createContent.create({ data: { id, organizationId: "org", campaignId: id, name: "Synthetic appeal", documentJson: {}, designJson: defaultDesign() } });
      await db.createVariant.create({ data: { contentId: id, organizationId: "org", channel: "LETTER" } });
    }
    await db.createImportSource.create({ data: { organizationId: "org", campaignId: "private", ownerId: "other-user", shared: false } });
    await db.createTrashItem.create({ data: { organizationId: "org", kind: "CONTENT", resourceId: "trashed" } });
    const searched = resultOf(await rpc(t.access_token, "tools/call", { name: "search_letters", arguments: {} })); expect(searched.items.map((item: { id: string }) => item.id)).toEqual(["visible"]);
    for (const id of ["private", "trashed"]) expect((await rpc(t.access_token, "tools/call", { name: "read_letter", arguments: { id, kind: "CREATE" } })).body.result.isError).toBe(true);
  });
  it("expires codes and access, revokes sessions, and rejects OAuth scope upgrades", async () => {
    const approved = await consent(); const code = new URL(approved.body.redirectUrl).searchParams.get("code")!;
    await db.chatGptGrant.update({ where: { id: rows.chatGptGrant[0].id }, data: { codeExpiresAt: new Date(0) } });
    expect((await exchange(code)).status).toBe(400);
    const t = await tokens("reports.read"), grant = rows.chatGptGrant[1];
    const refreshBody = { grant_type: "refresh_token", client_id: "oyama-chatgpt", resource, refresh_token: t.refresh_token };
    expect((await request(app).post(`${root}/oauth/token`).send({ ...refreshBody, scope: "letters.write reports.read" })).status).toBe(400);
    await db.chatGptGrant.update({ where: { id: grant.id }, data: { accessExpiresAt: new Date(0) } }); expect((await rpc(t.access_token, "ping")).status).toBe(401);
    const refreshed = await request(app).post(`${root}/oauth/token`).send(refreshBody); expect(refreshed.status).toBe(200);
    await request(app).delete(`${root}/connections/${grant.id}`).set("Authorization", `Bearer ${identity()}`);
    expect((await rpc(refreshed.body.access_token, "ping")).status).toBe(401);
    expect((await request(app).post(`${root}/oauth/token`).send({ ...refreshBody, refresh_token: refreshed.body.refresh_token })).status).toBe(400);
  });
  it("supports fiscal reporting and rejects invalid dates or extra inputs", async () => {
    const t = await tokens("reports.read");
    await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "designation-performance", year: 2025, dateBasis: "fiscal" } });
    const options = reporting.build.mock.calls[0][2]; expect(options.from.getFullYear()).toBe(2024); expect(options.from.getMonth()).toBe(6); expect(options.through.getFullYear()).toBe(2025); expect(options.through.getMonth()).toBe(5);
    for (const bad of [{ from: "2025-02-30" }, { from: "2025-11-01", through: "2025-01-01" }, { organizationId: "foreign" }]) expect((await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "campaign-performance", ...bad } })).body.result.isError).toBe(true);
  });
  it("continues legacy search past 100 records without including another tenant", async () => {
    const t = await tokens("letters.read");
    for (let n = 0; n < 105; n++) await db.letterTemplate.create({ data: { id: `letter-${String(n).padStart(3, "0")}`, name: "Synthetic old letter", organizationId: "org" } });
    await db.letterTemplate.create({ data: { id: "foreign-letter", name: "Private foreign", organizationId: "other-org" } });
    let cursor: string | null = null; const ids: string[] = [];
    do { const result = resultOf(await rpc(t.access_token, "tools/call", { name: "search_letters", arguments: cursor ? { cursor } : {} })); ids.push(...result.items.map((item: { id: string }) => item.id)); cursor = result.nextCursor; } while (cursor);
    expect(ids).toHaveLength(105); expect(new Set(ids).size).toBe(105); expect(ids).not.toContain("foreign-letter");
  });
  it("rejects foreign managed images and never exposes credentials in connection listings", async () => {
    const t = await tokens("letters.write");
    const bad = await rpc(t.access_token, "tools/call", { name: "create_letter_draft", arguments: { name: "Bad asset", html: '<p>Text</p><img src="/uploads/letter-media/foreign/header.png">', requestKey: "foreign-image" } });
    expect(bad.body.result.isError).toBe(true); expect(rows.createContent).toHaveLength(0);
    const listed = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity()}`); expect(JSON.stringify(listed.body)).not.toContain(t.access_token); expect(JSON.stringify(listed.body)).not.toContain("Hash");
  });
  it("allows only one simultaneous authorization-code exchange", async () => {
    const approved = await consent(); const code = new URL(approved.body.redirectUrl).searchParams.get("code")!;
    const results = await Promise.all([exchange(code), exchange(code)]); expect(results.map(r => r.status).sort()).toEqual([200, 400]);
  });
  it("passes the deployment probe against real discovery and MCP HTTP endpoints", async () => {
    const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing test port.");
      const local = `http://127.0.0.1:${address.port}`; vi.stubEnv("CHATGPT_PUBLIC_URL", local);
      expect(await checkChatGptConnection(local)).toMatchObject({ passed: true, mcpUrl: `${local}/api/chatgpt/mcp` });
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it("persists administrator MCP controls, rejects stale saves and enforces them on existing tokens", async () => {
    const t = await tokens();
    const policy = { ...DEFAULT_MCP_POLICY, defaultDateBasis: "fiscal", allowLetterDrafts: false, maxReportRows: 10 };
    const save = await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity()}`).send({ revision: 1, policy });
    expect(save.status, JSON.stringify(save.body)).toBe(200); expect(save.body.revision).toBe(2);
    expect((await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity()}`).send({ revision: 1, policy })).status).toBe(409);
    const tools = (await rpc(t.access_token, "tools/list")).body.result.tools.map((tool: { name: string }) => tool.name); expect(tools).not.toContain("create_letter_draft");
    expect((await rpc(t.access_token, "tools/call", { name: "create_letter_draft", arguments: { name: "Blocked", html: "<p>Blocked</p>", requestKey: "blocked-request" } })).body.error.code).toBe(-32602);
    expect((await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "campaign-performance", year: 2025, dateBasis: "calendar" } })).body.result.isError).toBe(true);
    const result = resultOf(await rpc(t.access_token, "tools/call", { name: "run_report", arguments: { report: "campaign-performance", year: 2025 } })); expect(result.dateBasis).toBe("fiscal"); expect(result.rowLimit).toBe(10); expect(result.exactRange.from).toContain("2024-07-01");
    const paused = { ...policy, enabled: false };
    expect((await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity()}`).send({ revision: 2, policy: paused })).status).toBe(200);
    expect((await rpc(t.access_token, "tools/list")).status).toBe(403);
    expect((await consent()).status).toBe(403);
    expect((await request(app).post(`${root}/oauth/token`).send({ grant_type: "refresh_token", client_id: "oyama-chatgpt", resource, refresh_token: t.refresh_token })).status).toBe(400);
    expect(rows.auditLog.some(row => row.action === "CHATGPT_MCP_CONTROLS_CHANGED")).toBe(true);
  });
  it("keeps policy changes tenant-scoped and administrator-only and validates control values", async () => {
    await db.user.update({ where: { id: "staff" }, data: { role: "staff" } });
    expect((await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity()}`).send({ revision: 1, policy: DEFAULT_MCP_POLICY })).status).toBe(403);
    const before = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity("other", "other-org")}`); expect(before.body.policyRevision).toBe(0); expect(before.body.policy.allowLetterDrafts).toBe(false);
    expect((await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity("other", "other-org")}`).send({ revision: 0, policy: { ...DEFAULT_MCP_POLICY, maxReportRows: 99999 } })).status).toBe(400);
    expect((await request(app).put(`${root}/settings`).set("Authorization", `Bearer ${identity("other", "other-org")}`).send({ revision: 0, policy: { ...DEFAULT_MCP_POLICY, enabled: false } })).status).toBe(200);
    expect((await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity()}`)).body.policy.enabled).toBe(true);
  });
  it("enables setup from Settings without environment edits or a callback allowlist", async () => {
    vi.stubEnv("CHATGPT_ENABLED", "false"); vi.stubEnv("CHATGPT_REDIRECT_URIS", "");
    expect((await request(app).post(`${root}/mcp`).send({})).status).toBe(503);
    const saved = await request(app).put(`${root}/setup`).set("Authorization", `Bearer ${identity()}`).send({ origin, enabled: true, revision: 0 });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await request(app).post(`${root}/mcp`).send({})).status).toBe(401);
    expect(process.env.CHATGPT_ENABLED).toBe("false"); expect(process.env.CHATGPT_REDIRECT_URIS).toBe("");
    const metadata = await request(app).get("/.well-known/oauth-authorization-server");
    expect(metadata.body).toMatchObject({ issuer: origin, client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true }); expect(metadata.body.registration_endpoint).toBeUndefined();
    const status = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity()}`); expect(status.body.setup).toMatchObject({ source: "settings", enabled: true, revision: 1 });
  });
  it("derives the public domain through the trusted proxy when no environment origin is configured", async () => {
    vi.stubEnv("CHATGPT_ENABLED", "false"); vi.stubEnv("CHATGPT_PUBLIC_URL", "<public domain>"); vi.stubEnv("NEXT_PUBLIC_APP_URL", ""); vi.stubEnv("FRONTEND_ORIGIN", "");
    app.set("trust proxy", 1);
    try {
      const saved = await request(app).put(`${root}/setup`).set("Authorization", `Bearer ${identity()}`).set("X-Forwarded-Proto", "https").set("X-Forwarded-Host", "crm.example.org").set("Origin", origin).send({ origin, enabled: true, revision: 0 });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const metadata = await request(app).get("/.well-known/oauth-authorization-server").set("X-Forwarded-Proto", "https").set("X-Forwarded-Host", "crm.example.org");
      expect(metadata.body.issuer).toBe(origin);
      expect((await request(app).post(`${root}/mcp`).set("X-Forwarded-Proto", "https").set("X-Forwarded-Host", "crm.example.org").send({})).status).toBe(401);
      expect((await request(app).post(`${root}/mcp`).set("X-Forwarded-Proto", "https").set("X-Forwarded-Host", "other.example.org").send({})).status).toBe(503);
    } finally { app.set("trust proxy", false); }
  });
  it("defaults blank requested scopes to read-only and refuses invalid legacy callback placeholders", async () => {
    const start = await request(app).get(`${root}/oauth/authorize`).query({ ...input(), scope: "" });
    expect(start.status).toBe(302); expect(new URL(start.headers.location).searchParams.get("scope")).toBe("letters.read reports.read");
    vi.stubEnv("CHATGPT_REDIRECT_URIS", "<exact redirect URI from ChatGPT>");
    expect((await consent()).status).toBe(400);
    expect((await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity()}`)).status).toBe(200);
  });
  it("automatically verifies and captures the exact ChatGPT callback through CIMD", async () => {
    const client = "https://chatgpt.com/oauth/synthetic-happy/client.json", callback = "https://chatgpt.com/connector/oauth/synthetic-happy";
    const fetchMock = vi.fn(async (url: string) => { expect(url).toBe(client); return new Response(JSON.stringify({ client_id: client, redirect_uris: [callback], token_endpoint_auth_methods_supported: ["private_key_jwt", "none"], token_endpoint_auth_method: "private_key_jwt" }), { headers: { "content-type": "application/json" } }); });
    vi.stubGlobal("fetch", fetchMock); vi.stubEnv("CHATGPT_REDIRECT_URIS", "");
    const params = { ...input(), client_id: client, redirect_uri: callback };
    const start = await request(app).get(`${root}/oauth/authorize`).query(params); expect(start.status, JSON.stringify(start.body)).toBe(302);
    const approved = await consent(params); expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const responseUrl = new URL(approved.body.redirectUrl); expect(responseUrl.searchParams.get("iss")).toBe(origin);
    const code = responseUrl.searchParams.get("code")!;
    const token = await exchange(code, { client_id: client, redirect_uri: callback }); expect(token.status, JSON.stringify(token.body)).toBe(200);
    expect((await rpc(token.body.access_token, "tools/list")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe(client);
    const status = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity()}`); expect(status.body.setup.verifiedCallback).toBe(callback);
    const cancelled = await consent({ ...params, approved: false }); expect(new URL(cancelled.body.redirectUrl).searchParams.get("iss")).toBe(origin);
    await request(app).post(`${root}/oauth/revoke`).send({ client_id: client, token: token.body.refresh_token }); expect((await rpc(token.body.access_token, "ping")).status).toBe(401);
  });
  it("rejects forged callbacks, hostile client URLs and unsupported client auth without issuing codes", async () => {
    const client = "https://chatgpt.com/oauth/synthetic-forgery/client.json", allowed = "https://chatgpt.com/connector/oauth/real-id";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ client_id: client, redirect_uris: [allowed], token_endpoint_auth_methods_supported: ["none"] })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await consent({ client_id: client, redirect_uri: "https://evil.example.org/callback" })).status).toBe(400);
    expect((await consent({ client_id: "https://chatgpt.com.evil.example.org/oauth/client.json" })).status).toBe(400); expect(fetchMock).toHaveBeenCalledTimes(1);
    const unsupported = "https://chatgpt.com/oauth/synthetic-auth/client.json";
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ client_id: unsupported, redirect_uris: [allowed], token_endpoint_auth_methods_supported: ["client_secret_basic"] })));
    expect((await consent({ client_id: unsupported, redirect_uri: allowed })).status).toBe(400); expect(rows.chatGptGrant).toHaveLength(0);
  });
  it("bounds client metadata and fails closed on unavailable or oversized responses", async () => {
    const unavailable = "https://chatgpt.com/oauth/synthetic-down/client.json";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Synthetic network failure"); }));
    expect((await request(app).get(`${root}/oauth/authorize`).query({ ...input(), client_id: unavailable })).status).toBe(503);
    const large = "https://chatgpt.com/oauth/synthetic-large/client.json";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x".repeat(32769))));
    expect((await consent({ client_id: large })).status).toBe(400); expect(rows.chatGptGrant).toHaveLength(0);
  });
  it("requires a current administrator, trusted domain and fresh setup revision", async () => {
    const save = (body: Record<string, unknown>, token = identity()) => request(app).put(`${root}/setup`).set("Authorization", `Bearer ${token}`).send(body);
    expect((await request(app).put(`${root}/setup`).set("Authorization", `Bearer ${identity()}`)).status).toBe(400);
    expect((await request(app).put(`${root}/setup`).set("Authorization", `Bearer ${identity()}`).send([])).status).toBe(400);
    expect((await save({ origin: "https://attacker.example.org", enabled: true, revision: 0 })).status).toBe(400);
    expect((await save({ origin, enabled: true, revision: 0 })).status).toBe(200);
    expect((await save({ origin, enabled: false, revision: 0 })).status).toBe(409);
    await db.user.update({ where: { id: "staff" }, data: { role: "staff" } });
    expect((await save({ origin, enabled: false, revision: 1 })).status).toBe(403);
    const other = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity("other", "other-org")}`); expect(other.body.setup.saved).toBe(false);
    vi.stubEnv("CHATGPT_FORCE_DISABLED", "true");
    expect((await save({ origin, enabled: true, revision: 0 }, identity("other", "other-org"))).status).toBe(403);
    expect((await request(app).post(`${root}/mcp`).send({})).status).toBe(503);
  });
  it("disables only the owning organization's existing sessions in a shared installation", async () => {
    vi.stubEnv("CHATGPT_ENABLED", "false");
    const save = (org: string, enabled: boolean, revision: number) => request(app).put(`${root}/setup`).set("Authorization", `Bearer ${identity(org === "org" ? "staff" : "other", org)}`).send({ origin, enabled, revision });
    await save("org", true, 0); const t = await tokens(); await save("other-org", true, 0); await save("org", false, 1);
    expect((await rpc(t.access_token, "tools/list")).status).toBe(403);
    const other = await request(app).get(`${root}/connections`).set("Authorization", `Bearer ${identity("other", "other-org")}`); expect(other.body.installationEnabled).toBe(true);
    expect((await request(app).post(`${root}/mcp`).send({})).status).toBe(401);
  });
  it("enforces the operator lock on existing tokens and token renewal", async () => {
    const t = await tokens(); vi.stubEnv("CHATGPT_FORCE_DISABLED", "true");
    expect((await rpc(t.access_token, "tools/list")).status).toBe(503);
    expect((await request(app).post(`${root}/oauth/token`).send({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: "oyama-chatgpt", resource })).status).toBe(400);
    expect((await consent()).status).toBe(400);
  });
});
