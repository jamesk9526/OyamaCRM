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
  it("completes oauth callback flow, runs graph provider test, and disconnects", async () => {
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
