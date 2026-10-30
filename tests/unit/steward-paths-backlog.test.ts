import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ task: { findMany: vi.fn() }, pledge: { findMany: vi.fn() }, auditLog: { findFirst: vi.fn(), create: vi.fn() } }));
const execute = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/services/stewardPathsEngine", () => ({ executeStewardPathsForTrigger: execute }));
vi.mock("@/server/src/services/steward-paths-sequence-engine", () => ({ processDueStewardPathEnrollments: vi.fn().mockResolvedValue({ processed: 0 }) }));
import { startStewardPathsWorker, stopStewardPathsWorker } from "@/server/src/services/steward-paths-worker";

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  db.task.findMany.mockResolvedValue([]); db.pledge.findMany.mockResolvedValue([]);
  db.auditLog.findFirst.mockImplementation(async ({ where }) => where.entityId === "z-missed" ? null : { id: "already-fired" });
  db.auditLog.create.mockResolvedValue({}); execute.mockResolvedValue(undefined);
});
afterEach(() => { stopStewardPathsWorker(); vi.useRealTimers(); });

describe("scheduled workflow backlog", () => {
  it("advances past 100 previously processed due tasks and pledges", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => ({ id: `a-${String(index).padStart(3, "0")}`, constituentId: "donor", constituent: { organizationId: "org" } }));
    const missed = { id: "z-missed", constituentId: "donor", constituent: { organizationId: "org" }, dueDate: new Date(), startDate: new Date(), totalAmount: 10 };
    db.task.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([missed]);
    db.pledge.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([missed]);
    startStewardPathsWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(execute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(36500);
    expect(db.task.findMany.mock.calls[1][0].where.id).toEqual({ gt: "a-099" });
    expect(db.pledge.findMany.mock.calls[1][0].where.id).toEqual({ gt: "a-099" });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ trigger: "TASK_DUE", taskId: "z-missed", organizationId: "org" }));
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ trigger: "PLEDGE_CREATED", constituentId: "donor", organizationId: "org" }));
    await vi.advanceTimersByTimeAsync(36500);
    expect(db.task.findMany.mock.calls[2][0].where.id).toBeUndefined();
    expect(db.task.findMany.mock.calls[2][0].where.archivedAt).toBeNull();
  });
  it("retries a failed batch before advancing its scan", async () => {
    const missed = { id: "z-missed", constituentId: "donor", constituent: { organizationId: "org" }, dueDate: new Date() };
    db.task.findMany.mockResolvedValueOnce([missed]).mockResolvedValueOnce([missed]);
    execute.mockRejectedValueOnce(new Error("Temporary failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      startStewardPathsWorker(); await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(36500);
      expect(db.task.findMany.mock.calls[1][0].where.id).toBeUndefined();
      expect(execute).toHaveBeenCalledTimes(2);
    } finally { log.mockRestore(); }
  });
});
