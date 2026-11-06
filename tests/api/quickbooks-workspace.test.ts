import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: { pluginSetting: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() }, qBSyncQueueItem: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() }, auditLog: { findMany: vi.fn() }, organization: { findUnique: vi.fn() }, donation: { findMany: vi.fn() }, $executeRaw: vi.fn(), $queryRaw: vi.fn(), $transaction: vi.fn() }, push: vi.fn(), callback: vi.fn(), audit: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/server/src/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: vi.fn().mockResolvedValue("org") }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, res: Response, next: NextFunction) => { if (req.headers["x-test-role"]) { req.user = { sub: "staff-user", email: "staff@example.invalid", orgId: "org", role: String(req.headers["x-test-role"]) }; next(); } else res.sendStatus(401); } }));
vi.mock("@/server/src/services/quickbooksService", () => ({ isQBConfigured: vi.fn().mockResolvedValue(true), getQBRuntimeStatus: vi.fn().mockResolvedValue({ redirectUri: "http://localhost/api/quickbooks/callback" }), saveQBPluginCredentials: vi.fn(), buildAuthUri: vi.fn().mockResolvedValue("https://appcenter.intuit.com/connect/oauth2"), handleOAuthCallback: mocks.callback, revokeTokens: vi.fn(), pushDonationToQB: mocks.push }));
import routes, { syncOneQuickBooksItem } from "@/server/src/routes/quickbooks";
import { processQuickBooksDailySyncPass } from "@/server/src/services/quickbooks-sync-worker";
const app = express(); app.use(express.json()); app.use("/api/quickbooks", routes);
const server = app.listen(0, "127.0.0.1");
beforeAll(() => new Promise<void>((resolve, reject) => { server.once("error", reject); if (server.listening) resolve(); else server.once("listening", resolve); }));
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));
const db = mocks.db;
let item: { id: string; organizationId: string; donationId: string; status: string; amount: number; attemptCount: number; donation: { status: string; createdAt: Date; date: Date; amount: number; constituent: { firstName: string; lastName: string } } };
let plugin: { id: string; organizationId: string; enabled: boolean; updatedAt: Date; config: { access_token: string; qbConnectedAt: string; qbDailySyncEnabled?: boolean; qbSendingMode?: string }; organization: { settings: { timezone: string } } };
beforeEach(() => {
  vi.clearAllMocks();
  item = { id: "gift", organizationId: "org", donationId: "donation", status: "PENDING", amount: 25, attemptCount: 0, donation: { status: "COMPLETED", createdAt: new Date("2026-11-04"), date: new Date("2026-11-04"), amount: 25, constituent: { firstName: "Sample", lastName: "Donor" } } };
  plugin = { id: "plugin", organizationId: "org", enabled: true, updatedAt: new Date(), config: { access_token: "secret", qbConnectedAt: "2026-11-01T00:00:00Z" }, organization: { settings: { timezone: "America/Chicago" } } };
  db.organization.findUnique.mockResolvedValue({settings:{timezone:"America/Chicago"}});
  db.donation.findMany.mockResolvedValue([]);
  db.pluginSetting.findUnique.mockImplementation(async () => plugin);
  db.qBSyncQueueItem.findFirst.mockImplementation(async ({ where }) => where.organizationId === "org" && where.id === item.id ? item : null);
  db.qBSyncQueueItem.update.mockImplementation(async ({ data }) => { if (data.attemptCount) item.attemptCount++; Object.assign(item, { ...data, attemptCount: item.attemptCount }); return item; });
  db.pluginSetting.upsert.mockResolvedValue({}); db.pluginSetting.updateMany.mockResolvedValue({ count: 1 });
  db.qBSyncQueueItem.findMany.mockResolvedValue([]); db.qBSyncQueueItem.count.mockResolvedValue(0); db.auditLog.findMany.mockResolvedValue([]);
  db.$queryRaw.mockResolvedValue([]); db.$executeRaw.mockResolvedValue(1); db.$transaction.mockImplementation(async run => run(db)); mocks.push.mockResolvedValue("receipt");
});
describe("QuickBooks workspace authorization and sending", () => {
  it("allows callback without CRM bearer token, but protects workspace APIs", async () => {
    mocks.callback.mockRejectedValueOnce(new Error("invalid state"));
    await request(server).get("/api/quickbooks/callback?state=org.invalid").expect(302).expect("Location", /quickbooks-sync\?qb=error/);
    await request(server).get("/api/quickbooks/activity").expect(401);
    await request(server).get("/api/quickbooks/activity").set("x-test-role", "readonly").expect(403);
  });
  it("lets staff connect, restricts automatic sending settings to admins, and validates mode", async () => {
    await request(server).get("/api/quickbooks/auth-uri").set("x-test-role", "staff").expect(200);
    await request(server).put("/api/quickbooks/settings").set("x-test-role", "staff").send({ sendingMode: "daily" }).expect(403);
    await request(server).put("/api/quickbooks/settings").set("x-test-role", "admin").send({ sendingMode: "invalid" }).expect(400);
    await request(server).put("/api/quickbooks/settings").set("x-test-role", "admin").send({ sendingMode: "daily" }).expect(200);
    expect(db.pluginSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { config: expect.objectContaining({ qbSendingMode: "daily" }) } }));
  });
  it("does not write for a different tenant, disconnected company, or pre-connection gift", async () => {
    expect((await syncOneQuickBooksItem("gift", "other-org")).success).toBe(false);
    plugin.enabled = false; expect((await syncOneQuickBooksItem("gift", "org")).success).toBe(false);
    plugin.enabled = true; item.donation.createdAt = new Date("2026-10-01"); expect((await syncOneQuickBooksItem("gift", "org")).success).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("serializes competing manual/worker sends and records the sending user", async () => {
    let tail = Promise.resolve();
    db.$transaction.mockImplementation(run => { const result = tail.then(() => run(db)); tail = result.then(() => undefined); return result; });
    const results = await Promise.all([syncOneQuickBooksItem("gift", "org", { userId: "staff-user" }), syncOneQuickBooksItem("gift", "org")]);
    expect(results.every(result => result.success)).toBe(true); expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "staff-user", action: "QB_SYNCED" }));
  });
  it("records a failed mapping and retries the same queue identity", async () => {
    mocks.push.mockRejectedValueOnce(new Error("Create an active Donations item"));
    expect((await syncOneQuickBooksItem("gift", "org")).success).toBe(false); expect(item.status).toBe("FAILED");
    expect((await syncOneQuickBooksItem("gift", "org")).success).toBe(true);
    expect(mocks.push.mock.calls.map(call => call[1].queueItemId)).toEqual(["gift", "gift"]);
  });
  it("does not enable daily sending from legacy flags or missing preferences", async () => {
    plugin.config.qbDailySyncEnabled = true;
    db.pluginSetting.findMany.mockResolvedValue([plugin]);
    await processQuickBooksDailySyncPass(new Date("2026-11-06T05:30:00Z"));
    expect(db.pluginSetting.updateMany).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
  });
  it("returns organization counts without credentials and defaults legacy installations to manual", async () => {
    plugin.config.qbDailySyncEnabled = true;
    const response = await request(server).get("/api/quickbooks/status").set("x-test-role", "staff").expect(200);
    expect(response.body.data.dailySyncEnabled).toBe(false);
    expect(response.body.data.summary).toEqual({pending:0,failed:0,lastSuccessfulSync:null});
    expect(response.text).not.toContain("secret");
    expect(db.qBSyncQueueItem.count).toHaveBeenCalledWith({where:{organizationId:"org",status:"PENDING"}});
  });
  it("runs daily sending only after the organization's hour and only after an atomic claim", async () => {
    plugin.config.qbSendingMode = "daily";
    db.pluginSetting.findMany.mockResolvedValue([plugin]);
    await processQuickBooksDailySyncPass(new Date("2026-11-05T12:00:00Z"));
    expect(db.pluginSetting.updateMany).not.toHaveBeenCalled();
    db.qBSyncQueueItem.findMany.mockResolvedValue([{id:"gift"}]);
    await processQuickBooksDailySyncPass(new Date("2026-11-06T05:30:00Z"));
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(db.pluginSetting.updateMany).toHaveBeenCalledWith(expect.objectContaining({where: expect.objectContaining({id:"plugin",updatedAt:plugin.updatedAt})}));
  });
  it("requires explicit administrator confirmation to send historical gifts", async () => {
    await request(server).post("/api/quickbooks/sync-queue/sync-history").set("x-test-role","staff").send({confirmPastHistory:true}).expect(403);
    await request(server).post("/api/quickbooks/sync-queue/sync-history").set("x-test-role","admin").send({}).expect(400);
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("filters activity to the authenticated organization", async () => {
    await request(server).get("/api/quickbooks/activity").set("x-test-role", "staff").expect(200);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org", action: { startsWith: "QB_" } } }));
  });
});
