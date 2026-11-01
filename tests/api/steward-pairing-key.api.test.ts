import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ config: { model: "qwen3.5:9b", apiKey: "" }, upsert: vi.fn() }));
vi.mock("../../server/src/lib/prisma.js", () => ({ prisma: {
  pluginSetting: { findUnique: vi.fn(async () => ({ id: "setting", enabled: true, config: state.config })), upsert: state.upsert },
  organization: { findUnique: vi.fn(async () => ({ name: "Test" })) }, auditLog: { create: vi.fn(async () => ({})) },
} }));
vi.mock("../../server/src/lib/organization.js", () => ({ resolveOrganizationId: vi.fn(async () => "org") }));
import router from "../../server/src/routes/steward-ai.js";
import { signAccessToken } from "../../server/src/lib/auth.js";
const app = express(); app.use(express.json()); app.use("/ai", router);
const token = signAccessToken({ sub: "admin", orgId: "org", role: "admin", email: "test@example.invalid" });
afterEach(() => vi.unstubAllGlobals());
describe("Steward pairing credentials", () => {
  it("rejects a wrong desktop key without changing saved CRM settings", async () => {
    const before = state.upsert.mock.calls.length;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({error:{message:"Missing or invalid Bearer token."}}),{status:401})));
    const connectionKey = JSON.stringify({endpoint:"https://bridge.example.invalid",apiKey:"wrong-key-12345",model:"qwen3.5:9b"});
    const response = await request(app).post("/ai/bridge/connect").set("Authorization", `Bearer ${token}`).send({connectionKey}).expect(422);
    expect(response.body.error.message).toContain("rejected this key");
    expect(state.upsert.mock.calls.length).toBe(before);
  });
  it("tests endpoint credentials and installed models before saving a desktop import", async () => {
    state.upsert.mockResolvedValue({id:"setting"});
    const fetcher = vi.fn(async () => new Response(JSON.stringify({models:[{name:"qwen3.5:9b"}]}),{status:200}));
    vi.stubGlobal("fetch",fetcher);
    const connectionKey = JSON.stringify({endpoint:"https://bridge.example.invalid",apiKey:"test-desktop-key-123",model:"qwen3.5:9b"});
    await request(app).post("/ai/bridge/connect").set("Authorization", `Bearer ${token}`).send({connectionKey}).expect(200);
    expect(fetcher.mock.calls.length).toBe(1);
    const args = fetcher.mock.calls[0] as unknown as [string,{headers:Record<string,string>}];
    expect(args[1].headers.Authorization).toBe("Bearer test-desktop-key-123");
    state.upsert.mockClear();
  });
  it("persists the initial shared key and reuses it on subsequent exports", async () => {
    state.upsert.mockImplementation(async args => { state.config = args.update.config; return { id: "setting" }; });
    const first = await request(app).post("/ai/bridge/pairing-key").set("Authorization", `Bearer ${token}`).send({ siteUrl: "https://crm.example.invalid" }).expect(200);
    const key = first.body.data.connectionKey.bridgeConfig.bridgeApiKey;
    expect(key).toBeTruthy(); expect(state.config.apiKey).toBe(key);
    const second = await request(app).post("/ai/bridge/pairing-key").set("Authorization", `Bearer ${token}`).send({ siteUrl: "https://crm.example.invalid" }).expect(200);
    expect(second.body.data.connectionKey.bridgeConfig.bridgeApiKey).toBe(key);
    expect(state.upsert).toHaveBeenCalledTimes(1);
    expect(first.body.data.readiness.checks.find((check: { id: string }) => check.id === "live-endpoint-test").status).toBe("Partially Working");
  });
});
