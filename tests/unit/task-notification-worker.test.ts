import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), notices: vi.fn(), archive: vi.fn(), assignment: vi.fn(), reminder: vi.fn(), overdue: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { task: { findMany: mocks.findMany }, notification: { findMany: mocks.notices, updateMany: mocks.archive } } }));
vi.mock("@/server/src/services/notifications", () => ({ createTaskAssignmentNotification: mocks.assignment, createTaskReminderNotification: mocks.reminder, createTaskOverdueNotification: mocks.overdue }));

import { getTaskNotificationWorkerStatus, processTaskNotificationPass, startTaskNotificationWorker, stopTaskNotificationWorker } from "@/server/src/services/task-notification-worker";

const now = new Date("2026-10-30T15:00:00Z");
const task = {
  id: "task-a", title: "Call donor", organizationId: "org-a", dueDate: new Date("2026-10-30T14:00:00Z"),
  reminderAt: new Date("2026-10-30T13:00:00Z"),
  assignee: { id: "user-a", organizationId: "org-a", active: true, role: "staff" },
  constituent: { organizationId: "org-a" },
};

beforeEach(async () => {
  await stopTaskNotificationWorker();
  mocks.findMany.mockReset().mockResolvedValue([]); mocks.reminder.mockReset().mockResolvedValue(undefined); mocks.overdue.mockReset().mockResolvedValue(undefined);
  mocks.notices.mockReset().mockResolvedValue([]); mocks.archive.mockReset().mockResolvedValue({ count: 0 });
  mocks.assignment.mockReset().mockResolvedValue(undefined);
  // Exhaust any previous paginated pass so each case begins from the first batch.
  await processTaskNotificationPass(now); mocks.findMany.mockClear();
});
afterEach(async () => { await stopTaskNotificationWorker(); vi.useRealTimers(); });

describe("task reminder production", () => {
  it("produces due reminders and overdue alerts with their exact lifecycle event timestamp", async () => {
    mocks.findMany.mockResolvedValue([task]); await processTaskNotificationPass(now);
    expect(mocks.reminder).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", assigneeId: "user-a", taskId: task.id, reminderAt: task.reminderAt }));
    expect(mocks.overdue).toHaveBeenCalledWith(expect.objectContaining({ dueDate: task.dueDate }));
    expect(mocks.findMany.mock.lastCall?.[0].where).toMatchObject({ status: { in: ["PENDING", "IN_PROGRESS"] }, archivedAt: null, assignee: { is: { active: true } } });
    expect(mocks.findMany.mock.lastCall?.[0].where.OR).toEqual([{ snoozedUntil: null }, { snoozedUntil: { lte: now } }]);
  });

  it("catches up undated assignments created by automations without inventing due reminders", async () => {
    mocks.findMany.mockResolvedValue([{ ...task, reminderAt: null, dueDate: null }]);
    await processTaskNotificationPass(now);
    expect(mocks.assignment).toHaveBeenCalledWith(expect.objectContaining({ taskId: task.id, assigneeId: "user-a" }));
    expect(mocks.reminder).not.toHaveBeenCalled(); expect(mocks.overdue).not.toHaveBeenCalled();
  });

  it("does not duplicate a Steward safety step's already-persisted staff notification", async () => {
    mocks.findMany.mockResolvedValue([{ ...task, sourceType: "steward-path-notification", reminderAt: null, dueDate: null }]);
    await processTaskNotificationPass(now); expect(mocks.assignment).not.toHaveBeenCalled();
  });

  it("supports staff tasks with no constituent and skips cross-tenant/inactive/care-only assignees", async () => {
    mocks.findMany.mockResolvedValue([
      { ...task, constituent: null, organizationId: null },
      { ...task, id: "wrong-user", assignee: { ...task.assignee, organizationId: "other" } },
      { ...task, id: "wrong-client", constituent: { organizationId: "other" } },
      { ...task, id: "inactive", assignee: { ...task.assignee, active: false } },
      { ...task, id: "care-only", assignee: { ...task.assignee, role: "compassion_user" } },
    ]);
    await processTaskNotificationPass(now); expect(mocks.overdue).toHaveBeenCalledTimes(1); expect(mocks.reminder).toHaveBeenCalledTimes(1);
  });

  it("does not fire future reminders or a due time that has not passed", async () => {
    mocks.findMany.mockResolvedValue([{ ...task, dueDate: now, reminderAt: new Date(now.getTime() + 1) }]);
    await processTaskNotificationPass(now); expect(mocks.reminder).not.toHaveBeenCalled(); expect(mocks.overdue).not.toHaveBeenCalled();
  });

  it("pages beyond the first 100 candidates, then restarts without starvation", async () => {
    mocks.findMany.mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ ...task, id: `task-${String(index).padStart(3, "0")}` })))
      .mockResolvedValueOnce([{ ...task, id: "task-100" }]).mockResolvedValueOnce([]);
    await processTaskNotificationPass(now); await processTaskNotificationPass(now); await processTaskNotificationPass(now);
    expect(mocks.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: "task-099" }, skip: 1 });
    expect(mocks.findMany.mock.calls[2][0].cursor).toBeUndefined(); expect(mocks.overdue).toHaveBeenCalledTimes(101);
  });

  it("isolates failed recipients and exposes a safe health failure instead of donor details", async () => {
    mocks.findMany.mockResolvedValue([task, { ...task, id: "task-b" }]);
    mocks.reminder.mockRejectedValueOnce(new Error("sensitive raw database diagnostic"));
    await processTaskNotificationPass(now);
    expect(mocks.overdue).toHaveBeenCalledWith(expect.objectContaining({ taskId: "task-b" }));
    expect(getTaskNotificationWorkerStatus().lastError).toContain("database availability");
    expect(JSON.stringify(getTaskNotificationWorkerStatus())).not.toContain("sensitive");
  });

  it("archives resolved, reassigned, deleted, or rescheduled task alerts from any task producer", async () => {
    const notice = { id: "notice-a", sourceId: "task-a", sourceType: "task-overdue", organizationId: "org-a", userId: "user-a", metadata: { eventAt: task.dueDate.toISOString() } };
    mocks.notices.mockResolvedValue([notice, { ...notice, id: "deleted", sourceId: "deleted" }, { ...notice, id: "reassigned", userId: "other-user" }, { ...notice, id: "rescheduled", metadata: { eventAt: "2026-01-01T00:00:00.000Z" } }]);
    mocks.findMany.mockResolvedValueOnce([{ ...task, status: "PENDING", archivedAt: null, assigneeId: "user-a" }]).mockResolvedValueOnce([]);
    await processTaskNotificationPass(now);
    expect(mocks.archive.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["deleted", "reassigned", "rescheduled"] } }, data: { status: "ARCHIVED" } });
  });

  it("starts idempotently and awaits in-flight delivery on shutdown", async () => {
    vi.useFakeTimers(); let finish: ((rows: never[]) => void) | undefined;
    mocks.findMany.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    startTaskNotificationWorker(); startTaskNotificationWorker();
    await vi.waitFor(() => expect(mocks.findMany).toHaveBeenCalledTimes(1));
    let stopped = false; const stop = stopTaskNotificationWorker().then(() => { stopped = true; });
    await Promise.resolve(); expect(stopped).toBe(false); finish?.([]); await stop;
    expect(getTaskNotificationWorkerStatus()).toMatchObject({ running: false, processing: false });
    expect(vi.getTimerCount()).toBe(0);
  });
});
