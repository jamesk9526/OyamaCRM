// API integration tests for Microsoft Graph OAuth provider connect/callback/test/disconnect flow.
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

describe("email provider microsoft graph api", () => {
  it("completes oauth callback flow, uses graph for provider and campaign test sends, and disconnects", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const saveProvider = await request(app)
      .put("/api/settings/email/provider")
      .set(auth)
      .send({
        provider: "microsoft_graph",
        microsoftTenantId: "common",
        microsoftClientId: "test-client-id",
        microsoftClientSecret: "test-client-secret",
        microsoftMailbox: "admin@hopefoundation.org",
        microsoftScope: "Mail.Send offline_access User.Read",
      });
    expect(saveProvider.status).toBe(200);

    const authUriResponse = await request(app)
      .get("/api/settings/email/provider/microsoft/auth-uri")
      .set(auth);
    expect(authUriResponse.status).toBe(200);
    expect(typeof authUriResponse.body?.data?.authUri).toBe("string");

    const authUri = new URL(String(authUriResponse.body.data.authUri));
    const state = authUri.searchParams.get("state");
    expect(state).toBeTruthy();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        token_type: "Bearer",
        scope: "Mail.Send offline_access User.Read",
        expires_in: 3600,
        access_token: "graph-access-token",
        refresh_token: "graph-refresh-token",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(new Response("", { status: 202 }));

    const callback = await request(app)
      .get(`/api/settings/email/provider/microsoft/callback?code=test-code&state=${encodeURIComponent(String(state))}`);
    expect(callback.status).toBe(302);
    expect(String(callback.headers.location ?? "")).toContain("microsoftGraph=connected");

    const providerAfterConnect = await request(app)
      .get("/api/settings/email/provider")
      .set(auth);
    expect(providerAfterConnect.status).toBe(200);
    expect(providerAfterConnect.body?.provider).toBe("microsoft_graph");
    expect(providerAfterConnect.body?.graphConnected).toBe(true);

    const providerTest = await request(app)
      .post("/api/settings/email/provider/test")
      .set(auth)
      .send({ toEmail: "admin@hopefoundation.org" });
    expect(providerTest.status).toBe(200);
    expect(providerTest.body?.mode).toBe("microsoft_graph");
    expect(String(providerTest.body?.message ?? "")).toContain("Provider test email sent");

    const campaign = await request(app)
      .post("/api/email-campaigns")
      .set(auth)
      .send({
        name: "Graph Campaign Test",
        subject: "Graph campaign send-test",
        fromName: "Hope Foundation",
        fromEmail: "admin@hopefoundation.org",
        bodyText: "Graph campaign body",
        templateJson: "{\"blocks\":[]}",
      });
    expect(campaign.status).toBe(201);

    const campaignTest = await request(app)
      .post(`/api/email-campaigns/${campaign.body.id}/send-test`)
      .set(auth)
      .send({ toEmail: "admin@hopefoundation.org" });
    expect(campaignTest.status).toBe(200);
    expect(campaignTest.body?.success).toBe(true);

    const fetchCalls = (globalThis.fetch as unknown as { mock?: { calls?: unknown[][] } }).mock?.calls ?? [];
    const graphSendMailCalls = fetchCalls.filter((call) => {
      const url = typeof call?.[0] === "string" ? call[0] : "";
      return url.includes("graph.microsoft.com") && url.includes("sendMail");
    });
    expect(graphSendMailCalls.length).toBeGreaterThanOrEqual(2);

    const disconnect = await request(app)
      .post("/api/settings/email/provider/microsoft/disconnect")
      .set(auth)
      .send({});
    expect(disconnect.status).toBe(200);

    const providerAfterDisconnect = await request(app)
      .get("/api/settings/email/provider")
      .set(auth);
    expect(providerAfterDisconnect.status).toBe(200);
    expect(providerAfterDisconnect.body?.graphConnected).toBe(false);
  });
});
