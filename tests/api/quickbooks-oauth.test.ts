import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: { pluginSetting: { findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), update: vi.fn() } }, createToken: vi.fn(), api: vi.fn(), valid: vi.fn(), refresh: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("intuit-oauth", () => ({  
default: class {
    setToken() { } isAccessTokenValid() { return mocks.valid(); } refresh() { return mocks.refresh(); }
    createToken(url: string) { return mocks.createToken(url); } makeApiCall(args: { url: string; method: string }) { return mocks.api(args); }
  }
}));
import { handleOAuthCallback, pushDonationToQB } from "@/server/src/services/quickbooksService";
const state = "org.nonce";
let plugin: { id: string; updatedAt: Date; config: { access_token: string; refresh_token: string; realmId: string; qbConnectedAt: string; qbOAuthStateHash: string; qbOAuthStateExpiresAt: number } };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("QB_CLIENT_ID", "synthetic-client"); vi.stubEnv("QB_CLIENT_SECRET", "synthetic-secret");
  plugin = { id: "plugin", updatedAt: new Date(), config: { access_token: "token", refresh_token: "refresh", realmId: "123", qbConnectedAt: "2026-11-01", qbOAuthStateHash: createHash("sha256").update(state).digest("hex"), qbOAuthStateExpiresAt: Date.now() + 60000 } };
  mocks.db.pluginSetting.findUnique.mockImplementation(async () => plugin);
  mocks.db.pluginSetting.updateMany.mockResolvedValue({ count: 1 }); mocks.db.pluginSetting.upsert.mockResolvedValue({}); mocks.db.pluginSetting.update.mockResolvedValue({});
  mocks.createToken.mockResolvedValue({ getToken: () => ({ access_token: "new", refresh_token: "new-refresh" }) }); mocks.valid.mockReturnValue(true);
});
describe("QuickBooks OAuth and receipt reconciliation", () => {
  it("rejects invalid and expired state before exchanging a code", async () => {
    await expect(handleOAuthCallback("http://localhost/callback", "org.bad")).rejects.toThrow("invalid or expired");
    plugin.config.qbOAuthStateExpiresAt = 0;
    await expect(handleOAuthCallback("http://localhost/callback", state)).rejects.toThrow("invalid or expired"); expect(mocks.createToken).not.toHaveBeenCalled();
  });
  it("consumes state once, handles canceled authorization, and requires the original company", async () => {
    await expect(handleOAuthCallback("http://localhost/callback?error=access_denied", state)).rejects.toThrow("canceled");
    await expect(handleOAuthCallback("http://localhost/callback?realmId=999", state)).rejects.toThrow("original QuickBooks company");
    mocks.db.pluginSetting.updateMany.mockResolvedValue({ count: 0 });
    await expect(handleOAuthCallback("http://localhost/callback?realmId=123", state)).rejects.toThrow("already been used"); expect(mocks.createToken).not.toHaveBeenCalled();
  });
  it("reads the company from callback and preserves original connection date", async () => {
    await handleOAuthCallback("http://localhost/callback?realmId=123&code=synthetic", state);
    expect(mocks.db.pluginSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { enabled: true, config: expect.objectContaining({ realmId: "123", qbConnectedAt: "2026-11-01", qbCompanyRealmId: "123" }) } }));
  });
  it("reconciles an accepted receipt on retry without issuing another POST", async () => {
    mocks.api.mockResolvedValue({ json: { QueryResponse: { SalesReceipt: [{ Id: "accepted-receipt" }] } } });
    const result = await pushDonationToQB("org", { donationId: "donation", queueItemId: "gift", customerName: "Sample", amount: 25, date: "2026-11-05" });
    expect(result).toBe("accepted-receipt"); expect(mocks.api).toHaveBeenCalledTimes(1); expect(mocks.api.mock.calls[0][0].method).toBe("GET");
  });
  it("keeps identical receipt request identifiers after a network timeout", async () => {
    const posts: string[] = [];
    mocks.api.mockImplementation(async args => {
      if (args.method === "POST" && args.url.includes("salesreceipt")) { posts.push(args.url); if (posts.length === 1) throw new Error("timeout"); return { json: { SalesReceipt: { Id: "receipt" } } }; }
      if (args.url.includes("Customer")) return { json: { QueryResponse: { Customer: [{ Id: "customer" }] } } };
      if (args.url.includes("Item")) return { json: { QueryResponse: { Item: [{ Id: "item" }] } } };
      return { json: { QueryResponse: {} } };
    });
    const payload = { donationId: "donation", queueItemId: "gift", customerName: "Sample", amount: 25, date: "2026-11-05" };
    await expect(pushDonationToQB("org", payload)).rejects.toThrow("timeout"); await pushDonationToQB("org", payload);
    expect(posts).toHaveLength(2); expect(posts[0]).toBe(posts[1]); expect(posts[0]).toContain("requestid=");
  });
  it("surfaces expired refresh credentials before any receipt write", async () => {
    mocks.valid.mockReturnValue(false); mocks.refresh.mockRejectedValueOnce(new Error("Reconnect QuickBooks"));
    await expect(pushDonationToQB("org", { donationId: "donation", queueItemId: "gift", customerName: "Sample", amount: 25, date: "2026-11-05" })).rejects.toThrow("Reconnect"); expect(mocks.api).not.toHaveBeenCalled();
  });
});
