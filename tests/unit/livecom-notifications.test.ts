import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ users: vi.fn(), create: vi.fn() }));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: { user: { findMany: mocks.users } } }));
vi.mock("@/server/src/services/notifications", () => ({ createNotification: mocks.create }));
import { notifyLiveComStaff } from "@/server/src/services/livecom-notifications";
const message = { organizationId: "org-a", conversationId: "conversation a", interactionId: "message-a", visitorName: "Visitor", message: "Hello", siteName: "Website" };
beforeEach(() => { vi.resetAllMocks(); mocks.create.mockResolvedValue({ id: "notification-a" }); });
describe("LiveCom notification recipients", () => {
  it("honors inbox permission denies/grants instead of broadcasting to every platform role", async () => {
    mocks.users.mockResolvedValue([
      { id: "admin", role: "admin", permissions: [] },
      { id: "denied-staff", role: "staff", permissions: [{ granted: false }] },
      { id: "granted-viewer", role: "report_viewer", permissions: [{ granted: true }] },
      { id: "board-viewer", role: "report_viewer", permissions: [] },
    ]);
    await notifyLiveComStaff(message);
    expect(mocks.create.mock.calls.map(([input]) => input.userId)).toEqual(["admin", "granted-viewer"]);
    expect(mocks.users.mock.lastCall?.[0].where).toEqual({ organizationId: "org-a", active: true, role: { not: "compassion_user" } });
    expect(mocks.users.mock.lastCall?.[0].take).toBeUndefined();
    expect(mocks.create.mock.calls[0][0].href).toBe("/livecom/inbox?conversationId=conversation%20a");
  });
  it("continues other staff deliveries when one save fails and logs no visitor data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.users.mockResolvedValue([{ id: "a", role: "staff", permissions: [] }, { id: "b", role: "staff", permissions: [] }]);
    mocks.create.mockRejectedValueOnce(new Error("private database detail"));
    await notifyLiveComStaff(message); expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("private"); warn.mockRestore();
  });
});
