import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ $queryRaw: vi.fn(), notification: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx), notification: tx.notification } }));
import { createNotification, createTaskOverdueNotification, createTaskReminderNotification, resolveTaskNotifications } from "@/server/src/services/notifications";
import { safeNotificationHref } from "@/app/components/notifications/notification-client";
beforeEach(() => { vi.resetAllMocks(); tx.$queryRaw.mockResolvedValue([{ id: "u1" }]); tx.notification.findFirst.mockResolvedValue(null); tx.notification.create.mockResolvedValue({ id: "n1" }); });
const input = { organizationId: "org1", userId: "u1", sourceType: "test", title: "Work ready", message: "Review work", href: "/tasks" };
describe("durable notification lifecycle", () => {
  it("locks and verifies the active recipient inside the same creation transaction", async () => {
    await createNotification(input); expect(tx.$queryRaw).toHaveBeenCalled(); expect(tx.notification.create).toHaveBeenCalled();
    tx.$queryRaw.mockResolvedValue([]); await createNotification({ ...input, userId: "foreign" }); expect(tx.notification.create).toHaveBeenCalledTimes(1);
  });
  it("deduplicates a dismissed reminder across polls/restarts using its lifecycle timestamp", async () => {
    tx.notification.findFirst.mockResolvedValue({ id: "dismissed" });
    const reminderAt = new Date("2026-10-30T12:00Z");
    await createTaskReminderNotification({ organizationId: "org1", assigneeId: "u1", taskId: "task", taskTitle: "Call", reminderAt });
    expect(tx.notification.findFirst.mock.lastCall?.[0].where).toMatchObject({ sourceType: "task-reminder", sourceId: "task", archivedAt: null, metadata: { path: "$.eventAt", equals: reminderAt.toISOString() } });
    expect(tx.notification.findFirst.mock.lastCall?.[0].where.status).toBeUndefined(); expect(tx.notification.findFirst.mock.lastCall?.[0].where.createdAt).toBeUndefined(); expect(tx.notification.create).not.toHaveBeenCalled();
  });
  it("preserves task timestamps and encodes task deep links", async () => {
    const dueDate = new Date("2026-10-29T00:00Z"); await createTaskOverdueNotification({ organizationId: "org1", assigneeId: "u1", taskId: "task&bad", taskTitle: "Call", dueDate });
    expect(tx.notification.create.mock.lastCall?.[0].data).toMatchObject({ href: "/tasks?taskId=task%26bad&focus=overdue", metadata: { eventAt: dueDate.toISOString() } });
  });
  it("archives only the matching tenant/task/recipient lifecycle", async () => {
    await resolveTaskNotifications({ organizationId: "org1", taskId: "task", assigneeId: "u1" });
    expect(tx.notification.updateMany).toHaveBeenCalledWith({ where: { organizationId: "org1", sourceId: "task", userId: "u1", sourceType: { in: ["task-assigned", "task-reminder", "task-overdue"] }, archivedAt: null }, data: { archivedAt: expect.any(Date), status: "ARCHIVED" } });
  });
  it("can resolve only rescheduled reminder notices without reviving a dismissed assignment", async () => {
    await resolveTaskNotifications({ organizationId: "org1", taskId: "task", sourceTypes: ["task-reminder"] });
    expect(tx.notification.updateMany.mock.lastCall?.[0].where.sourceType).toEqual({ in: ["task-reminder"] });
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil", "/\t/evil", "/tasks\nLocation: evil"])("rejects unsafe notification destinations %s", async (href) => {
    await expect(createNotification({ ...input, href })).rejects.toThrow("application path"); expect(safeNotificationHref(href)).toBe("/notifications");
  });
});
