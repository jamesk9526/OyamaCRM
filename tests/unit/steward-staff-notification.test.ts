import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  enrollments: { findMany: vi.fn(), update: vi.fn() }, runs: { upsert: vi.fn(), update: vi.fn() },
  steps: { findMany: vi.fn() }, timeline: { create: vi.fn() }, tasks: { create: vi.fn() }, notify: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: {
  stewardPathEnrollment: mocks.enrollments, stewardPathStepRun: mocks.runs, stewardPathStep: mocks.steps,
  stewardPathTimelineEvent: mocks.timeline, task: mocks.tasks,
} }));
vi.mock("@/server/src/services/notifications", () => ({ createNotification: mocks.notify }));
vi.mock("@/server/src/services/letters-execution", () => ({ generateLetterFromTemplate: vi.fn() }));
import { processDueStewardPathEnrollments } from "@/server/src/services/steward-paths-sequence-engine";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enrollments.findMany.mockResolvedValue([{
    id: "enrollment-a", organizationId: "org-a", constituentId: "donor-a", ownerUserId: "owner-a", currentStepId: "step-a",
    path: { id: "path-a", status: "ACTIVE", defaultOwnerId: null },
    currentStep: { id: "step-a", name: "Review donor request", stepType: "MANUAL_ACTION", configJson: { command: "safety.notify_staff", instruction: "Review the incoming request." } },
  }]);
  mocks.runs.upsert.mockResolvedValue({ id: "run-a", status: "PENDING" });
  mocks.tasks.create.mockResolvedValue({ id: "task-a" }); mocks.notify.mockResolvedValue({ id: "notice-a" });
  mocks.steps.findMany.mockResolvedValue([]); mocks.timeline.create.mockResolvedValue({ id: "event-a" });
});
describe("Steward staff notification step", () => {
  it("saves a durable inbox notification before creating its task and advancing the workflow", async () => {
    const result = await processDueStewardPathEnrollments({ organizationId: "org-a" });
    expect(result.failed).toBe(0);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-a", userId: "owner-a", sourceId: "run-a", persistent: true, href: "/steward-paths/enrollments?pathId=path-a" }));
    expect(mocks.tasks.create.mock.lastCall?.[0].data).toMatchObject({ organizationId: "org-a", sourceType: "steward-path-notification", sourceId: "run-a" });
    expect(mocks.notify.mock.invocationCallOrder[0]).toBeLessThan(mocks.tasks.create.mock.invocationCallOrder[0]);
  });
  it("fails without creating a misleading follow-up task when the durable alert could not be saved", async () => {
    mocks.notify.mockRejectedValue(new Error("Unavailable"));
    const result = await processDueStewardPathEnrollments({ organizationId: "org-a" });
    expect(result.failed).toBe(1); expect(mocks.tasks.create).not.toHaveBeenCalled();
    expect(mocks.runs.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
  });
  it("refuses recipients outside the active organization", async () => {
    mocks.notify.mockResolvedValue(null);
    const result = await processDueStewardPathEnrollments({ organizationId: "org-a" });
    expect(result.failed).toBe(1); expect(mocks.tasks.create).not.toHaveBeenCalled();
  });
});
