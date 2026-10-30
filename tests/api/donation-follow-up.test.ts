import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({ donation: { findFirst: vi.fn() }, task: { findFirst: vi.fn(), create: vi.fn() }, user: { findFirst: vi.fn() }, activity: { create: vi.fn() }, $queryRaw: vi.fn() }));
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), notify: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/server/src/services/notifications", () => ({ createTaskAssignmentNotification: mocks.notify }));
import { createDonationFollowUp } from "@/server/src/services/donation-follow-up";
const input = { requestId: "followup-attempt-0001", title: "Thank donor for this gift", type: "THANK_YOU", priority: "HIGH", dueDate: "2026-11-02T20:00:00Z", reminderAt: "2026-11-02T15:00:00Z", assigneeId: "staff-a", constituentId: "person-a" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.transaction.mockImplementation((work) => work(tx));
  tx.donation.findFirst.mockResolvedValue({ id: "gift-a", constituentId: "person-a" });
  tx.$queryRaw.mockResolvedValue([{ id: "gift-a" }]); tx.task.findFirst.mockResolvedValue(null);
  tx.user.findFirst.mockResolvedValue({ id: "staff-a" }); tx.activity.create.mockResolvedValue({ id: "activity-a" });
  tx.task.create.mockResolvedValue({ id: "task-a", title: input.title, assigneeId: "staff-a", constituentId: "person-a", dueDate: new Date(input.dueDate), status: "PENDING", sourceType: "donation-follow-up", sourceId: "gift-a" });
});
describe("donation follow-up creation", () => {
  it("derives the donor from the authorized gift and records task/donation provenance atomically", async () => {
    const result = await createDonationFollowUp("org-a", "operator-a", "gift-a", input);
    expect(result.id).toBe("task-a"); expect(result.reused).toBe(false);
    expect(tx.donation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "gift-a", constituent: { organizationId: "org-a" } } }));
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", constituentId: "person-a", sourceType: "donation-follow-up", sourceId: "gift-a", metadata: { donationId: "gift-a", requestId: input.requestId }, createdById: "operator-a" });
    expect(tx.activity.create.mock.calls[0][0].data).toMatchObject({ donationId: "gift-a", constituentId: "person-a", taskId: "task-a" });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ taskId: "task-a", assigneeId: "staff-a", organizationId: "org-a" }));
  });
  it("reuses a saved attempt after a network retry without duplicate activity or assignment notices", async () => {
    tx.task.findFirst.mockResolvedValue({ id: "existing-task", assigneeId: "staff-a", status: "PENDING" });
    const result = await createDonationFollowUp("org-a", "operator-a", "gift-a", input);
    expect(result).toMatchObject({ id: "existing-task", reused: true });
    expect(tx.task.create).not.toHaveBeenCalled(); expect(tx.activity.create).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("rejects a gift outside the current organization", async () => {
    tx.donation.findFirst.mockResolvedValue(null);
    await expect(createDonationFollowUp("org-a", "operator-a", "foreign-gift", input)).rejects.toMatchObject({ status: 404 });
    expect(tx.task.create).not.toHaveBeenCalled();
  });
  it("rejects a different constituent or an inactive/foreign assignee", async () => {
    await expect(createDonationFollowUp("org-a", "operator-a", "gift-a", { ...input, constituentId: "other" })).rejects.toThrow("gift's donor");
    tx.user.findFirst.mockResolvedValue(null);
    await expect(createDonationFollowUp("org-a", "operator-a", "gift-a", input)).rejects.toThrow("active staff");
    expect(tx.task.create).not.toHaveBeenCalled();
  });
  it("rejects invalid dates, request IDs, or spoofed task provenance", async () => {
    for (const values of [{ ...input, dueDate: "2026-02-31T15:00:00Z" }, { ...input, requestId: "" }, { ...input, sourceId: "fake" }, { ...input, reminderAt: "2026-11-03T15:00:00Z" }]) await expect(createDonationFollowUp("org-a", "operator-a", "gift-a", values)).rejects.toThrow();
    expect(tx.task.create).not.toHaveBeenCalled();
  });
  it("keeps task success distinct from notification failure", async () => {
    mocks.notify.mockRejectedValue(new Error("notification unavailable"));
    await expect(createDonationFollowUp("org-a", "operator-a", "gift-a", input)).resolves.toMatchObject({ id: "task-a", notificationWarning: expect.stringContaining("Task saved") });
  });
});
