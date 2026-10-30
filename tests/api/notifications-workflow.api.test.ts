import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { notification: db } }));
vi.mock("@/server/src/lib/organization", () => ({ resolveOrganizationId: async () => "notice-org" }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => { req.user = { sub: "notice-user", role: "staff", email: "test@example.invalid", orgId: "notice-org" }; next(); } }));
import router from "@/server/src/routes/notifications";
const app = express(); app.use(express.json()); app.use("/api/notifications", router);
const notice = { id: "n1", sourceType: "task-assigned", title: "Call donor", message: "Assigned", href: "/tasks?taskId=t1", createdAt: new Date("2026-10-30T10:00Z"), severity: "HIGH", status: "UNREAD", module: "donor", actionLabel: "Open task", snoozedUntil: null, expiresAt: null };
beforeEach(() => { vi.resetAllMocks(); db.findMany.mockImplementation(async (query) => query.distinct ? [{ module: "donor" }, { module: "events" }] : [notice]); db.count.mockResolvedValue(1); db.updateMany.mockResolvedValue({ count: 1 }); });

describe("notification inbox workflow", () => {
  it("scopes list, total, unread badge and module choices to the same tenant/user", async () => {
    const response = await request(app).get("/api/notifications?module=all&page=2&pageSize=25");
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ unreadCount: 1, total: 1, page: 2, totalPages: 1, modules: ["donor", "events"] });
    expect(response.body.items[0]).toMatchObject({ id: "n1", status: "unread", priority: "high" });
    expect(db.findMany.mock.calls[0][0]).toMatchObject({ skip: 25, take: 25, where: { organizationId: "notice-org", userId: "notice-user", archivedAt: null, status: { in: ["UNREAD", "READ"] } } });
    for (const [query] of db.count.mock.calls) { expect(query.where).toMatchObject({ organizationId: "notice-org", userId: "notice-user" }); expect(query.where.AND).toEqual(expect.arrayContaining([expect.objectContaining({ OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] })])); }
  });
  it("exposes snoozed items without removing the selected workspace from available options", async () => {
    expect((await request(app).get("/api/notifications?status=snoozed&module=events")).status).toBe(200);
    expect(db.findMany.mock.calls[0][0].where).toMatchObject({ module: "events", AND: expect.arrayContaining([{ snoozedUntil: { gt: expect.any(Date) } }]) });
    expect(db.findMany.mock.calls[1][0].where.module).toBeUndefined();
  });
  it("keeps snoozed reminders unread so they reappear in the badge after their wake time", async () => {
    const until = new Date(Date.now() + 3600000).toISOString();
    expect((await request(app).patch("/api/notifications/n1/snooze").send({ until })).status).toBe(200);
    expect(db.updateMany.mock.lastCall?.[0]).toMatchObject({ where: { id: "n1", organizationId: "notice-org", userId: "notice-user" }, data: { status: "UNREAD", readAt: null, snoozedUntil: new Date(until) } });
    expect((await request(app).patch("/api/notifications/n1/unsnooze").send({})).status).toBe(200);
    expect(db.updateMany.mock.lastCall?.[0].data).toEqual({ status: "UNREAD", readAt: null, snoozedUntil: null });
  });
  it.each(["2020-01-01", "not-a-date", new Date(Date.now() + 31 * 86400000).toISOString()])("rejects invalid snooze time %s without writing", async (until) => {
    expect((await request(app).patch("/api/notifications/n1/snooze").send({ until })).status).toBe(400); expect(db.updateMany).not.toHaveBeenCalled();
  });
  it("mark-all read affects only visible, unexpired, awake unread alerts in the chosen workspace", async () => {
    expect((await request(app).post("/api/notifications/mark-all-read").send({ module: "events" })).status).toBe(200);
    expect(db.updateMany.mock.lastCall?.[0]).toMatchObject({ where: { module: "events", status: "UNREAD", organizationId: "notice-org", userId: "notice-user", AND: expect.any(Array) }, data: { status: "READ" } });
  });
  it("does not restore dismissed/expired/foreign notifications through read or snooze", async () => {
    db.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).patch("/api/notifications/foreign/read")).status).toBe(404);
    expect(db.updateMany.mock.lastCall?.[0].where).toMatchObject({ userId: "notice-user", organizationId: "notice-org", status: { in: ["UNREAD", "READ"] }, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] }] });
  });
  it.each(["status=invalid", "page=0", "pageSize=1000", "module=../../secret"])("validates malformed filters: %s", async (query) => {
    expect((await request(app).get(`/api/notifications?${query}`)).status).toBe(400); expect(db.findMany).not.toHaveBeenCalled();
  });
  it("returns a recoverable migration error instead of a fake empty inbox", async () => {
    db.findMany.mockRejectedValue({ code: "P2021" });
    const response = await request(app).get("/api/notifications"); expect(response.status).toBe(503); expect(response.body.error.code).toBe("MIGRATION_REQUIRED");
  });
});
