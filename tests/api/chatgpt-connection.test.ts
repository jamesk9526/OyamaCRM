/** Synthetic persistence; real OAuth, MCP and Create handlers. No real donor data or OpenAI calls. */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
const reporting = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock("@/server/src/services/donor-report-library", async importOriginal => ({ ...await importOriginal<object>(), buildDonorLibraryReport: reporting.build }));
import router, { authorizationMetadata, protectedResourceMetadata, chatGptRateLimiter } from "@/server/src/chatgpt/routes";
import { authorizationInput, connectionConfig, hashToken } from "@/server/src/chatgpt/config";
import { signAccessToken } from "@/server/src/lib/auth";
import { defaultDesign } from "@/server/src/oyama-create/studio/design";
import { checkChatGptConnection } from "../../scripts/chatgpt-check.mjs";
import { DEFAULT_MCP_POLICY, MCP_POLICY_KEY } from "@/server/src/chatgpt/policy";
const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use("/api/chatgpt", router);
app.get("/.well-known/oauth-authorization-server", (_req, res) => res.json(authorizationMetadata()));
app.get("/.well-known/oauth-protected-resource/api/chatgpt/mcp", (_req, res) => res.json(protectedResourceMetadata()));
app.use((e: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { void _next; res.status(500).json({ error: e.message }); });
const root = "/api/chatgpt", origin = "https://crm.example.invalid", redirect = "https://chatgpt.com/connector_platform/oauth/callback", resource = `${origin}${root}/mcp`;
const verifier = "a".repeat(43), challenge = Buffer.from(hashToken(verifier), "hex").toString("base64url");
const identity = (id = "staff", orgId = "org") => signAccessToken({ sub: id, orgId, role: "admin", email: `${id}@example.invalid` });
const input = (scope = "letters.read letters.write reports.read") => ({ response_type: "code", client_id: "oyama-chatgpt", redirect_uri: redirect, resource, code_challenge: challenge, code_challenge_method: "S256", scope, state: "synthetic-state" });
async function consent(overrides = {}) { return request(app).post(`${root}/oauth/consent`).set("Authorization", `Bearer ${identity()}`).send({ ...input(), approved: true, ...overrides }); }
async function exchange(code: string, overrides = {}) { return request(app).post(`${root}/oauth/token`).type("form").send({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: "oyama-chatgpt", redirect_uri: redirect, resource, ...overrides }); }
async function tokens(scope?: string) { const result = await consent(scope ? { scope } : {}); expect(result.status, JSON.stringify(result.body)).toBe(200); const code = new URL(result.body.redirectUrl).searchParams.get("code")!; const response = await exchange(code); expect(response.status, JSON.stringify(response.body)).toBe(200); return response.body; }
async function rpc(token: string, method: string, params?: unknown) { return request(app).post(`${root}/mcp`).set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method, params }); }
const resultOf = (response: { body: { result: { content: { text: string }[] } } }) => JSON.parse(response.body.result.content[0].text);
beforeEach(async () => {
  chatGptRateLimiter.resetKey("::ffff:127.0.0.1"); chatGptRateLimiter.resetKey("127.0.0.1");
  resetCreateRows(); vi.stubEnv("CHATGPT_ENABLED", "true"); vi.stubEnv("CHATGPT_PUBLIC_URL", origin); vi.stubEnv("CHATGPT_REDIRECT_URIS", redirect);
  await db.user.create({ data: { id: "staff", organizationId: "org", active: true, role: "admin", email: "staff@example.invalid" } });
  await db.user.create({ data: { id: "other", organizationId: "other-org", active: true, role: "admin", email: "other@example.invalid" } });
  await db.organizationSettings.create({ data: { organizationId: "org", oyamaCreateEnabled: true, oyamaCreateStudioEnabled: true, fiscalYearStart: 7 } });
  await db.createBrandRevision.create({ data: { id: "brand", organizationId: "org", revision: 1, documentJson: {} } });
  await db.pluginSetting.create({ data: { organizationId: "org", pluginKey: MCP_POLICY_KEY, config: { revision: 1, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true, allowDateBasisOverride: true } } } });
  reporting.build.mockReset().mockResolvedValue({ report: "campaign-performance", title: "Synthetic aggregate report", rows: [{ campaign: "Synthetic appeal", totalAmount: 123.45 }], columns: [{ key: "totalAmount", type: "currency" }], audienceConstituentIds: ["private-donor"], notices: [] });
});
describe.sequential("ChatGPT account connection", () => {
  it("publishes discovery and rejects missing credentials", async () => {
    expect(authorizationMetadata()).toMatchObject({ issuer: origin, token_endpoint_auth_methods_supported: ["none"], code_challenge_methods_supported: ["S256"] });
    expect((await request(app).get(`${root}/resource-metadata`)).body.resource).toBe(resource);
    const response = await request(app).post(`${root}/mcp`).send({}); expect(response.status).toBe(401); expect(response.headers["www-authenticate"]).toContain("resource_metadata=");
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
});
