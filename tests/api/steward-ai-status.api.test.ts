// API tests for Steward AI runtime status endpoint and connection/error transitions.
import request from "supertest";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { loginAsAdmin } from "@/tests/helpers/auth";

let app: Awaited<typeof import("@/server/src/index")>["default"];
let adminToken = "";

beforeAll(async () => {
  const mod = await import("@/server/src/index");
  app = mod.default;

  const admin = await loginAsAdmin(app);
  adminToken = admin.token;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function saveAiConfig(enabled: boolean) {
  await request(app)
    .put("/api/steward-ai/config")
    .set({ Authorization: `Bearer ${adminToken}` })
    .send({
      enabled,
      mode: "local",
      endpointUrl: "http://127.0.0.1:11434",
      model: "llama3.2:3b",
      thinkingModel: "deepseek-r1:8b",
      reasoningMode: "thinking",
      agenticMultiStage: true,
      chatHeadEnabled: true,
      temperature: 0.3,
      maxTokens: 600,
      timeoutMs: 36500,
      systemPrompt: "Steward runtime status test configuration.",
    })
    .expect(200);
}

describe("steward ai runtime status api", () => {
  it("returns disabled or not_configured state when runtime is not active", async () => {
    await saveAiConfig(false);

    const response = await request(app)
      .get("/api/steward-ai/status")
      .set({ Authorization: `Bearer ${adminToken}` });

    expect(response.status).toBe(200);
    expect(["disabled", "not_configured"]).toContain(response.body?.data?.status);
    expect(response.body?.data?.enabled).toBe(false);
  });

  it("returns connected status after successful health check", async () => {
    await saveAiConfig(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        models: [{ name: "deepseek-r1:8b" }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await request(app)
      .get("/api/steward-ai/status?force=1")
      .set({ Authorization: `Bearer ${adminToken}` });

    expect(response.status).toBe(200);
    expect(response.body?.data?.status).toBe("connected");
    expect(response.body?.data?.enabled).toBe(true);
  });

  it("stores error state after failed connection test", async () => {
    await saveAiConfig(true);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("runtime unreachable"));

    const failedTest = await request(app)
      .post("/api/steward-ai/test")
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({});

    expect(failedTest.status).toBe(502);

    const status = await request(app)
      .get("/api/steward-ai/status")
      .set({ Authorization: `Bearer ${adminToken}` });

    expect(status.status).toBe(200);
    expect(status.body?.data?.status).toBe("error");
    expect(String(status.body?.data?.lastErrorMessage || "").length).toBeGreaterThan(0);
  });
});
