import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ subscriptions: vi.fn(), current: vi.fn(), recipient: vi.fn(), notices: vi.fn(), claim: vi.fn(), update: vi.fn(), send: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: {
  notificationEmailSubscription: { findMany: mocks.subscriptions, findFirst: mocks.current }, user: { findFirst: mocks.recipient },
  notification: { findMany: mocks.notices }, notificationEmailDelivery: { create: mocks.claim, update: mocks.update },
} }));
vi.mock("@/server/src/services/smtp-service", () => ({ sendOrganizationEmail: mocks.send }));
import { processNotificationEmails, validNotificationSubject, notificationSubject } from "@/server/src/services/notification-email";
const subscription = { id: "s1", organizationId: "org1", userId: "admin1", enabled: true, subjectTemplate: "[CRM] {title}", minimumSeverity: "ALL", enabledAt: new Date(), updatedAt: new Date() };
const notice = { id: "n1", title: "Call donor", message: "Follow up", module: "donor", severity: "HIGH" };
beforeEach(() => {
  vi.resetAllMocks(); mocks.subscriptions.mockResolvedValue([subscription]); mocks.current.mockResolvedValue(subscription);
  mocks.recipient.mockResolvedValue({ email: "admin@example.invalid" }); mocks.notices.mockResolvedValue([notice]); mocks.claim.mockResolvedValue({ id: "d1" }); mocks.update.mockResolvedValue({}); mocks.send.mockResolvedValue(undefined);
});
describe("personal administrator notification email", () => {
  it("scopes delivery to the enabled user's active admin identity and own future alerts", async () => {
    await processNotificationEmails();
    expect(mocks.recipient).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "admin1", organizationId: "org1", active: true, role: "admin" } }));
    expect(mocks.notices.mock.calls[0][0].where).toMatchObject({ organizationId: "org1", userId: "admin1", createdAt: { gte: subscription.enabledAt }, archivedAt: null, status: { in: ["UNREAD", "READ"] }, emailDeliveries: { none: { subscriptionId: "s1" } } });
    expect(mocks.notices.mock.calls[0][0].where.AND).toHaveLength(2);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@example.invalid", organizationId: "org1", subject: "[CRM] Call donor" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "SENT", completedAt: expect.any(Date) } }));
  });
  it("does not send after unsubscribe or preference change", async () => { mocks.current.mockResolvedValue(null); await processNotificationEmails(); expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled(); });
  it("does not send to deactivated, moved, or demoted administrators", async () => { mocks.recipient.mockResolvedValue(null); await processNotificationEmails(); expect(mocks.notices).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled(); });
  it("does not send a duplicate when another worker already claimed the alert", async () => { mocks.claim.mockRejectedValue({ code: "P2002" }); await processNotificationEmails(); expect(mocks.send).not.toHaveBeenCalled(); });
  it("records SMTP failure without silently retrying", async () => { mocks.send.mockRejectedValue(new Error("provider rejected")); await processNotificationEmails(); expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "FAILED", completedAt: expect.any(Date) } })); });
  it("preserves an uncertain claim if recording provider acceptance fails", async () => { mocks.update.mockRejectedValue(new Error("database unavailable")); await expect(processNotificationEmails()).rejects.toThrow("database unavailable"); expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.update).toHaveBeenCalledTimes(1); });
  it("includes critical alerts in the high-priority option", async () => { mocks.subscriptions.mockResolvedValue([{ ...subscription, minimumSeverity: "HIGH" }]); await processNotificationEmails(); expect(mocks.notices.mock.calls[0][0].where.severity).toEqual({ in: ["HIGH", "CRITICAL"] }); });
  it.each(["", "   ", "Bad\r\nBcc: other", "{unknown}", "{title", "a".repeat(181), null])("rejects unsafe or invalid subject %s", value => { expect(validNotificationSubject(value)).toBe(false); });
  it("renders only supported tokens and removes header controls from notification content", () => {
    expect(validNotificationSubject("[{module}/{severity}] {title}")).toBe(true);
    expect(notificationSubject("[{module}/{severity}] {title}", { ...notice, title: "A\r\nB" })).toBe("[donor/HIGH] A  B");
  });
});
