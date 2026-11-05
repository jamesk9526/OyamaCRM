/** Synthetic records; real OAuth, MCP, policy, retrieval and command handlers. */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/server/src/lib/prisma", async () => ({ prisma: (await import("../helpers/create-memory-database")).createMemoryDatabase }));
import { createMemoryDatabase as db, createRows as rows, resetCreateRows } from "../helpers/create-memory-database";
import router, { chatGptRateLimiter } from "@/server/src/chatgpt/routes";
import { signAccessToken } from "@/server/src/lib/auth";
import { hashToken } from "@/server/src/chatgpt/config";
import { emptyAccessDocument, type AccessDocument } from "@/server/src/ai-access/contracts";
import { CAPABILITIES, RESOURCES, WRITE_CAPABILITIES } from "@/server/src/ai-access/catalog";
import { presetRules, resolvePolicy } from "@/server/src/ai-access/policy";
import { processAiOperations } from "@/server/src/ai-access/operations";
import { AI_POLICY_KEY } from "@/server/src/ai-access/policy";
import { MCP_POLICY_KEY, DEFAULT_MCP_POLICY } from "@/server/src/chatgpt/policy";
import { readFile } from "node:fs/promises";

const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use("/api/chatgpt", router);
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { void _next; res.status(500).json({ error: { message: error.message } }); });
const origin = "https://crm.example.org", root = "/api/chatgpt", resource = `${origin}${root}/mcp`, redirect = "https://chatgpt.com/connector_platform/oauth/callback";
const verifier = "a".repeat(43), challenge = Buffer.from(hashToken(verifier), "hex").toString("base64url");
const identity = (id = "admin", org = "org", role = "admin") => signAccessToken({ sub: id, orgId: org, role, email: `${id}@example.invalid` });
const api = (method: "get" | "put" | "post" | "delete", path: string, body?: object, actor = identity()) => request(app)[method](`${root}${path}`).set("Authorization", `Bearer ${actor}`).send(body);
async function install(document?: AccessDocument) {
  const doc = document || { ...emptyAccessDocument(), organization: presetRules("supervised") };
  const result = await api("put", "/access", { revision: 0, document: doc });
  expect(result.status, JSON.stringify(result.body)).toBe(200); return doc;
}
async function connect(scopes: string[]) {
  const preview = await api("get", `/access/consent?${new URLSearchParams({ scopes: scopes.join(" ") })}`);
  expect(preview.status, JSON.stringify(preview.body)).toBe(200);
  const approved = await api("post", "/oauth/consent", { response_type: "code", client_id: "oyama-chatgpt", redirect_uri: redirect, resource, code_challenge: challenge, code_challenge_method: "S256", scope: scopes.join(" "), state: "synthetic", approved: true, consentProof: preview.body.proof });
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  const code = new URL(approved.body.redirectUrl).searchParams.get("code");
  const result = await request(app).post(`${root}/oauth/token`).type("form").send({ grant_type: "authorization_code", client_id: "oyama-chatgpt", redirect_uri: redirect, resource, code, code_verifier: verifier });
  expect(result.status, JSON.stringify(result.body)).toBe(200); return result.body.access_token as string;
}
const rpc = (token: string, method: string, params: unknown = {}) => request(app).post(`${root}/mcp`).set("Authorization", `Bearer ${token}`).send({ jsonrpc: "2.0", id: 1, method, params });
const call = (token: string, name: string, args = {}) => rpc(token, "tools/call", { name, arguments: args });
const output = (response: { body: { result: { content: { text: string }[]; isError?: boolean } } }) => { expect(response.body.result.isError, JSON.stringify(response.body)).not.toBe(true); return JSON.parse(response.body.result.content[0].text); };
const contextScopes = ["crm.search", "crm.context", "constituents.read"];
beforeEach(async () => {
  resetCreateRows(); vi.unstubAllGlobals();
  chatGptRateLimiter.resetKey("::ffff:127.0.0.1"); chatGptRateLimiter.resetKey("127.0.0.1");
  vi.stubEnv("CHATGPT_FORCE_DISABLED", ""); vi.stubEnv("CHATGPT_ENABLED", "true"); vi.stubEnv("CHATGPT_PUBLIC_URL", origin); vi.stubEnv("CHATGPT_REDIRECT_URIS", redirect);
  await db.user.create({ data: { id: "admin", organizationId: "org", role: "admin", active: true, email: "admin@example.invalid" } });
  await db.user.create({ data: { id: "other", organizationId: "other-org", role: "admin", active: true, email: "other@example.invalid" } });
  await db.organizationSettings.create({ data: { organizationId: "org", currency: "USD", timezone: "America/Chicago", fiscalYearStart: 1 } });
  await db.pluginSetting.create({ data: { organizationId: "org", pluginKey: MCP_POLICY_KEY, config: { revision: 1, policy: { ...DEFAULT_MCP_POLICY, allowLetterDrafts: true } } } });
  await db.constituent.create({ data: { id: "donor", organizationId: "org", firstName: "Jordan", lastName: "Example", email: "jordan@example.invalid", notes: "SYNTHETIC_PRIVATE_NOTE", closedAt: null, householdId: null } });
  await db.constituent.create({ data: { id: "foreign", organizationId: "other-org", firstName: "Jordan", lastName: "Private", email: "hidden@example.invalid", closedAt: null } });
  await db.constituent.create({ data: { id: "closed", organizationId: "org", firstName: "Closed", lastName: "Record", closedAt: new Date() } });
});
describe.sequential("AI access and CRM context", () => {
  it("starts new capabilities blocked, keeps legacy scopes bounded and protects policy administration", async () => {
    const view = await api("get", "/access"); expect(view.status).toBe(200);
    expect(view.body.capabilities.find((cap: { key: string }) => cap.key === "constituents.read").effective.mode).toBe("blocked");
    expect((await api("put", "/access", { revision: 0, document: emptyAccessDocument() }, identity("other", "other-org"))).status).toBe(200);
    await db.user.create({ data: { id: "viewer", organizationId: "org", role: "readonly", active: true, email: "viewer@example.invalid" } });
    expect((await api("put", "/access", { revision: 0, document: emptyAccessDocument() }, identity("viewer", "org", "admin"))).status).toBe(403);
    const token = await connect(["letters.read", "reports.read"]);
    expect((await rpc(token, "tools/list")).body.result.tools.some((tool: { name: string }) => tool.name === "search")).toBe(false);
    expect((await call(token, "search", { query: "Jordan" })).body.result.isError).toBe(true);
  });
  it("saves versioned policy, rejects stale writes and foreign policy subjects", async () => {
    const doc = await install();
    expect(rows.aiAccessRevision).toHaveLength(1);
    expect((await api("put", "/access", { revision: 0, document: doc })).status).toBe(409);
    expect((await api("put", "/access", { revision: 1, document: { ...doc, users: { other: { "constituents.read": { mode: "automatic" } } } } })).status).toBe(400);
  });
  it("resolves ceilings, role defaults, user exceptions and connection/consent limits", () => {
    const document = emptyAccessDocument();
    document.organization["gifts.update"] = { mode: "automatic" };
    document.roles.staff = { "gifts.update": { mode: "blocked" } };
    document.users.admin = { "gifts.update": { mode: "approval" } };
    document.connections.link = { "gifts.update": { mode: "automatic" } };
    const snapshot = { version: 1 as const, policyRevision: 1, capabilities: { "gifts.update": { mode: "approval" as const } }, constraints: {}, limits: document.limits };
    const grant = { id: "link", scopes: "gifts.update", consentJson: snapshot };
    expect(resolvePolicy(document, "gifts.update", { sub: "admin", role: "staff" }, grant).mode).toBe("approval");
    document.organization["gifts.update"] = { mode: "blocked" };
    expect(resolvePolicy(document, "gifts.update", { sub: "admin", role: "staff" }, grant).mode).toBe("blocked");
  });
  it("filters fields before text matching and never returns foreign or closed records", async () => {
    await install(); const token = await connect(contextScopes);
    const result = output(await call(token, "search", { query: "Jordan" }));
    expect(result.results.map((item: { id: string }) => item.id)).toEqual(["constituents:donor"]);
    expect(result.results[0].url).toBe(`${origin}/constituents/donor`);
    expect(output(await call(token, "search", { query: "SYNTHETIC_PRIVATE_NOTE" })).results).toEqual([]);
    const record = output(await call(token, "fetch", { id: "constituents:donor" }));
    expect(record.text).toContain("Jordan"); expect(record.text).not.toContain("jordan@example.invalid"); expect(record.text).not.toContain("PRIVATE_NOTE");
    for (const id of ["constituents:foreign", "constituents:closed"]) expect((await call(token, "fetch", { id })).body.result.isError).toBe(true);
  });
  it("requires new consent for new fields and stops access immediately on narrowing", async () => {
    const doc = await install(); const token = await connect(contextScopes);
    expect(output(await call(token, "get_crm_record", { id: "constituents:donor" })).fields.email).toBeUndefined();
    const renewed = await connect([...contextScopes, "constituents.contact.read"]);
    expect(output(await call(renewed, "get_crm_record", { id: "constituents:donor" })).fields.email).toBe("jordan@example.invalid");
    doc.organization["constituents.contact.read"] = { mode: "blocked" };
    expect((await api("put", "/access", { revision: 1, document: doc })).status).toBe(200);
    expect(output(await call(renewed, "get_crm_record", { id: "constituents:donor" })).fields.email).toBeUndefined();
    await db.userPermission.create({ data: { userId: "admin", permission: "view:constituents", granted: false } });
    expect((await call(renewed, "get_crm_record", { id: "constituents:donor" })).body.result.isError).toBe(true);
  });
  it("writes through the native constituent handler with a current version and idempotency", async () => {
    await install(); const token = await connect([...contextScopes, "constituents.update"]);
    const donor = output(await call(token, "get_crm_record", { id: "constituents:donor" }));
    const args = { id: "donor", expectedVersion: donor.version, requestKey: "update-donor-001", fields: { firstName: "Alex" } };
    const result = output(await call(token, "crm_constituents_update", args));
    expect(result.status, JSON.stringify(result)).toBe("SUCCEEDED");
    expect(rows.constituent.find(row => row.id === "donor")?.firstName).toBe("Alex");
    const repeated = output(await call(token, "crm_constituents_update", args)); expect(repeated.operationId).toBe(result.operationId);
    expect(rows.aiOperation).toHaveLength(1);
    expect((await call(token, "crm_constituents_update", { ...args, requestKey: "update-donor-002" })).body.result.isError).toBe(true);
  });
  it("requires CRM review for financial writes, rejects stale reviews and prevents duplicate execution", async () => {
    await install(); const token = await connect(["crm.context", "funds.read", "funds.create"]);
    const pending = output(await call(token, "crm_funds_create", { fields: { name: "Synthetic fund" }, requestKey: "create-fund-001" }));
    expect(pending.status).toBe("PENDING"); expect(rows.designation).toHaveLength(0);
    expect((await call(token, "approve_operation", { id: pending.operationId })).body.error.code).toBe(-32602);
    expect((await api("post", `/access/operations/${pending.operationId}/decision`, { approved: true })).status).toBe(200);
    await Promise.all([processAiOperations(origin), processAiOperations(origin)]);
    expect(rows.designation).toHaveLength(1); expect(rows.designation[0].organizationId).toBe("org");
    expect((await api("post", `/access/operations/${pending.operationId}/decision`, { approved: true })).status).toBe(404);
    const record = output(await call(token, "get_crm_record", { id: `funds:${rows.designation[0].id}` }));
    expect(record.fields.name).toBe("Synthetic fund");
  });
  it("cancels pending work on disconnection and keeps another tenant's operations private", async () => {
    await install(); const token = await connect(["crm.context", "funds.read", "funds.create"]);
    const pending = output(await call(token, "crm_funds_create", { fields: { name: "Never created" }, requestKey: "create-fund-cancel" }));
    const grant = rows.chatGptGrant[0];
    expect((await api("get", `/access/operations/${pending.operationId}`, undefined, identity("other", "other-org"))).status).toBe(404);
    expect((await api("delete", `/access/connections/${grant.id}`)).status).toBe(204);
    await processAiOperations(origin); expect(rows.designation).toHaveLength(0); expect(rows.aiOperation[0].status).toBe("CANCELLED");
  });
  it("uses only declared native endpoints and excludes secret/clinical fields from the registry", async () => {
    const secret = /password|secret|accessToken|refreshToken|smtp|tokenHash/i;
    for (const res of RESOURCES) expect(res.fields.some(field => secret.test(field)), res.key).toBe(false);
    expect(RESOURCES.some(res => /compassion|vault/i.test(res.model))).toBe(false);
    const files: Record<string, string> = { constituents: "constituents", donations: "donations", campaigns: "campaigns", tasks: "tasks", meetings: "meetings", events: "events", grants: "grants", households: "households", email: "email-campaigns", paths: "steward-paths", webmaster: "webmaster", qr: "qr-codes", customReports: "custom-reports", letters: "letters", customFields: "custom-fields" };
    for (const cap of WRITE_CAPABILITIES) if (cap.native && cap.native.router !== "create") {
      const source = await readFile(`server/src/routes/${files[cap.native.router]}.ts`, "utf8");
      const normalized = cap.native.path.replace(/:[A-Za-z]+/g, ":id");
      const routes = [...source.matchAll(/router\.(post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)].map(match => `${match[1].toUpperCase()} ${match[2].replace(/:[A-Za-z]+/g, ":id")}`);
      if (["meetings.complete", "meetings.cancel"].includes(cap.key)) continue; // Native controller registers this fixed action loop.
      expect(routes, cap.key).toContain(`${cap.native.method} ${normalized}`);
    }
    expect(new Set(CAPABILITIES.map(cap => cap.key)).size).toBe(CAPABILITIES.length);
    expect(rows.pluginSetting.some(row => row.pluginKey === AI_POLICY_KEY)).toBe(false);
  });
});
