/** Synthetic persistence, real meeting settings and lifecycle handlers. No live database. */
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ meeting: null as Record<string, unknown> | null, config: null as Record<string, unknown> | null, claimed: true }));
const db = vi.hoisted(() => ({
  meeting: { findFirst: vi.fn(), findFirstOrThrow: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
  pluginSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  user: { findFirst: vi.fn() }, constituent: { findFirst: vi.fn() },
  task: { create: vi.fn() }, activity: { create: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = { sub: "staff", orgId: String(req.headers["x-org"] || "org"), role: String(req.headers["x-role"] || "staff"), email: "synthetic@example.invalid" }; next();
} }));
import routes from "@/server/src/routes/meetings";
const app = express(); app.use(express.json()); app.use("/api/meetings", routes);
const call = (method: "get" | "post" | "patch" | "put", path: string, body?: unknown, role = "staff", org = "org") => {
  const action = request(app)[method](`/api/meetings${path}`).set("x-role", role).set("x-org", org);
  return body === undefined ? action : action.send(body as object);
};
beforeEach(() => {
  vi.clearAllMocks(); state.meeting = null; state.config = null; state.claimed = true;
  db.$transaction.mockImplementation(async work => work(db));
  db.pluginSetting.findUnique.mockImplementation(async () => state.config ? { config: state.config } : null);
  db.pluginSetting.upsert.mockImplementation(async input => { state.config = input.update.config; return input; });
  db.meeting.create.mockImplementation(async input => { state.meeting = { id: "meeting", updatedAt: new Date(), type: "OTHER", locationType: "IN_PERSON", location: null, ...input.data }; return state.meeting; });
  db.meeting.findFirst.mockImplementation(async input => state.meeting && state.meeting.organizationId === input.where.organizationId ? { ...state.meeting } : null);
  db.meeting.findFirstOrThrow.mockImplementation(async () => ({ ...state.meeting }));
  db.meeting.updateMany.mockImplementation(async input => { if (!state.claimed) return { count: 0 }; Object.assign(state.meeting!, input.data); return { count: 1 }; });
  db.user.findFirst.mockImplementation(async input => input.where.id === "foreign" || input.where.id === "inactive" ? null : { id: input.where.id });
  db.constituent.findFirst.mockImplementation(async input => input.where.id === "donor" ? { id: "donor" } : null);
  db.task.create.mockResolvedValue({ id: "task" }); db.activity.create.mockResolvedValue({ id: "activity" }); db.auditLog.create.mockResolvedValue({ id: "audit" });
});
const input = { title: "  Synthetic donor visit  ", startTime: "2026-11-04T14:00:00Z", constituentId: "donor", assignedStaffId: "staff" };
const settings = { defaultDuration: 45, autoTimeline: true, autoFollowUp: true, followUpDays: 3, followUpMessage: "  Send a thank-you and recap.  " };

describe("persisted meeting defaults", () => {
  it("serves safe defaults and restricts audited settings changes to admins in their tenant", async () => {
    const initial = await call("get", "/settings"); expect(initial.status).toBe(200); expect(initial.body).toMatchObject({ defaultDuration: 60, autoFollowUp: false, canManage: false });
    expect((await call("put", "/settings", settings)).status).toBe(403);
    const saved = await call("put", "/settings", settings, "admin"); expect(saved.status).toBe(200); expect(saved.body.followUpMessage).toBe("Send a thank-you and recap.");
    expect(db.pluginSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_pluginKey: { organizationId: "org", pluginKey: "meeting-defaults" } } }));
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect((await call("put", "/settings", { ...settings, defaultDuration: 0 }, "admin")).status).toBe(400);
  });
  it("uses default duration and honors the timeline preference on create and cancel", async () => {
    state.config = { ...settings, autoTimeline: false, followUpMessage: settings.followUpMessage.trim() };
    const created = await call("post", "/", input); expect(created.status).toBe(201); expect(created.body.title).toBe("Synthetic donor visit");
    expect(created.body.endTime).toBe("2026-11-04T14:45:00.000Z"); expect(db.activity.create).not.toHaveBeenCalled();
    expect((await call("post", "/meeting/cancel", {})).status).toBe(200); expect(db.activity.create).not.toHaveBeenCalled();
  });
});
describe("meeting lifecycle and relationship integrity", () => {
  it.each([
    ["complete", "COMPLETED"], ["cancel", "CANCELED"], ["no-show", "NO_SHOW"],
  ])("accepts a bodyless %s action", async (action, status) => {
    await call("post", "/", input);
    const result = await call("post", `/meeting/${action}`);
    expect(result.status).toBe(200); expect(result.body.status).toBe(status);
  });
  it("still rejects explicit non-object lifecycle bodies before writing", async () => {
    await call("post", "/", input);
    expect((await call("post", "/meeting/cancel", [])).status).toBe(400);
    expect(db.meeting.updateMany).not.toHaveBeenCalled();
  });
  it("lists flagged completed meetings and legacy follow-ups without widening personal or tenant scope", async () => {
    const completed = { ...input, id: "completed-follow-up", organizationId: "org", createdById: "staff", status: "COMPLETED", followUpNeeded: true };
    const legacy = { ...completed, id: "legacy-follow-up", status: "NEEDS_FOLLOW_UP", followUpNeeded: false };
    db.meeting.findMany.mockResolvedValue([completed, legacy]); db.meeting.count.mockResolvedValue(2);
    const result = await call("get", "/?followUpNeeded=true");
    expect(result.status).toBe(200); expect(result.body.items.map((item: { id: string }) => item.id)).toEqual(["completed-follow-up", "legacy-follow-up"]);
    const where = db.meeting.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: "org", OR: [{ createdById: "staff" }, { assignedStaffId: "staff" }], AND: [{ OR: [{ followUpNeeded: true, status: { not: "CANCELED" } }, { status: "NEEDS_FOLLOW_UP" }] }] });
    expect(db.meeting.count).toHaveBeenCalledWith({ where });
  });
  it("creates one assigned follow-up and completion activity despite repeated completion", async () => {
    state.config = { ...settings, followUpMessage: settings.followUpMessage.trim() }; await call("post", "/", input); db.activity.create.mockClear();
    const done = await call("post", "/meeting/complete", { outcome: "Reviewed next steps." }); expect(done.status).toBe(200); expect(done.body.followUpNeeded).toBe(true);
    expect((await call("post", "/meeting/complete", {})).status).toBe(200);
    expect(db.task.create).toHaveBeenCalledTimes(1); expect(db.activity.create).toHaveBeenCalledTimes(1);
    expect(db.activity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      description: 'Meeting completed: "Synthetic donor visit". Outcome: Reviewed next steps.',
      metadata: { meetingId: "meeting", outcome: "Reviewed next steps.", followUpNeeded: true },
    }) }));
    const task = db.task.create.mock.calls[0][0].data;
    expect(task).toMatchObject({ organizationId: "org", meetingId: "meeting", constituentId: "donor", assigneeId: "staff", description: "Send a thank-you and recap.", type: "FOLLOW_UP" });
    expect(task.dueDate.getTime() - (state.meeting!.completedAt as Date).getTime()).toBe(3 * 86400000);
    expect((await call("post", "/meeting/cancel", {})).status).toBe(409);
  });
  it("keeps default completion free of automatic follow-ups and blocks stale lifecycle claims", async () => {
    await call("post", "/", input);
    expect(db.activity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      type: "MEETING_SCHEDULED", description: `Meeting scheduled: "Synthetic donor visit" on ${new Date(input.startTime).toLocaleDateString()}.`,
      metadata: { meetingId: "meeting", type: "OTHER", locationType: "IN_PERSON", location: null },
    }) }));
    state.claimed = false;
    expect((await call("post", "/meeting/complete", {})).status).toBe(409); expect(db.task.create).not.toHaveBeenCalled();
    state.claimed = true; expect((await call("post", "/meeting/complete", {})).status).toBe(200); expect(db.task.create).not.toHaveBeenCalled();
  });
  it("rejects invalid dates, enums, booleans, foreign relationships and readonly writes", async () => {
    for (const change of [{ title: " " }, { startTime: "invalid" }, { endTime: "2026-01-01T00:00:00Z" }, { type: "BAD" }, { locationType: "BAD" }, { followUpNeeded: "yes" }, { assignedStaffId: "foreign" }, { assignedStaffId: "inactive" }, { constituentId: "foreign" }, { meetingUrl: "javascript:alert(1)" }]) {
      expect((await call("post", "/", { ...input, ...change })).status).toBe(400);
    }
    expect((await call("post", "/", input, "readonly")).status).toBe(403); expect(db.meeting.create).not.toHaveBeenCalled();
  });
  it("rejects status bypasses and cross-tenant lifecycle actions", async () => {
    await call("post", "/", input);
    expect((await call("patch", "/meeting", { status: "COMPLETED" })).status).toBe(400);
    expect((await call("patch", "/meeting", { endTime: "bad" })).status).toBe(400);
    expect((await call("post", "/meeting/complete", {}, "admin", "foreign")).status).toBe(404);
    expect(db.meeting.updateMany).not.toHaveBeenCalled();
  });
});
