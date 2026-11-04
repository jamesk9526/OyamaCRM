import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ emailCampaign: { findMany: vi.fn(), count: vi.fn(), update: vi.fn() } }));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/server/src/lib/prisma", () => ({ prisma: database }));
vi.mock("@/server/src/routes/email-campaigns", () => ({ sendCampaignNow: send }));
import { startEmailQueueWorker, stopEmailQueueWorker } from "@/server/src/services/email-queue-worker";

const scheduledAt = new Date("2026-01-01T12:00:00Z");
const paused = Array.from({ length: 10 }, (_, index) => ({
  id: `paused-${index}`, scheduledAt,
  audienceFilter: JSON.stringify({ _workflow: { queueState: "PAUSED" } }),
}));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  database.emailCampaign.findMany.mockResolvedValue([]);
  database.emailCampaign.count.mockResolvedValue(0);
  send.mockResolvedValue(undefined);
});
afterEach(() => { stopEmailQueueWorker(); vi.useRealTimers(); });

describe("scheduled email backlog traversal", () => {
  it("advances past a full paused batch and revisits it after a sweep", async () => {
    database.emailCampaign.findMany.mockResolvedValueOnce(paused).mockResolvedValueOnce([
      { id: "later-campaign", scheduledAt: new Date("2026-01-02T12:00:00Z"), audienceFilter: null },
    ]);
    startEmailQueueWorker(); await vi.advanceTimersByTimeAsync(0);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);
    expect(database.emailCampaign.findMany.mock.calls[1][0].where.OR).toEqual([
      { scheduledAt: { gt: scheduledAt } },
      { scheduledAt, id: { gt: "paused-9" } },
    ]);
    expect(send).toHaveBeenCalledWith("later-campaign", "QUEUE");
    await vi.advanceTimersByTimeAsync(15000);
    expect(database.emailCampaign.findMany.mock.calls[2][0].where.OR).toBeUndefined();
  });

  it("uses deterministic schedule ordering and retains due-only filtering", async () => {
    startEmailQueueWorker(); await vi.advanceTimersByTimeAsync(0);
    const query = database.emailCampaign.findMany.mock.calls[0][0];
    expect(query.orderBy).toEqual([{ scheduledAt: "asc" }, { id: "asc" }]);
    expect(query.where.status).toBe("SCHEDULED");
    expect(query.where.scheduledAt).toEqual({ not: null, lte: expect.any(Date) });
  });

  it("retains its cursor when scanning fails so the same backlog is retried", async () => {
    database.emailCampaign.findMany.mockResolvedValueOnce(paused).mockRejectedValueOnce(new Error("Synthetic outage")).mockResolvedValueOnce([]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      startEmailQueueWorker(); await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(15000);
      await vi.advanceTimersByTimeAsync(15000);
      expect(database.emailCampaign.findMany.mock.calls[2][0].where.OR).toEqual(database.emailCampaign.findMany.mock.calls[1][0].where.OR);
    } finally { log.mockRestore(); }
  });
});
