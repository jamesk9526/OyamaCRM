import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
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
describe("Steward pairing credentials", () => {
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
