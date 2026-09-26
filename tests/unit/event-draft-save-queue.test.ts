import { afterEach, describe, expect, it, vi } from "vitest";
import { EventDraftSaveQueue } from "@/app/lib/event-draft-save-queue";

afterEach(() => vi.useRealTimers());
describe("event draft save queue", () => {
  it("flushes debounce immediately before publishing", async () => {
    vi.useFakeTimers(); const calls: string[] = [];
    const queue = new EventDraftSaveQueue(async (value: string) => { calls.push(value); }, vi.fn());
    queue.schedule("latest"); await queue.run(async () => { calls.push("publish"); });
    expect(calls).toEqual(["latest", "publish"]); expect(queue.dirty).toBe(false); queue.dispose();
  });
  it("serializes writes and drains edits made during an in-flight save", async () => {
    vi.useFakeTimers(); const calls: string[] = []; let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const queue = new EventDraftSaveQueue(async (value: string) => { calls.push(value); if (value === "first") await wait; }, vi.fn());
    queue.schedule("first"); const flush = queue.flush(); await Promise.resolve(); await Promise.resolve();
    queue.schedule("second"); const publish = queue.run(async () => { calls.push("publish"); });
    release(); await flush; await publish;
    expect(calls).toEqual(["first", "second", "publish"]); queue.dispose();
  });
  it("retains failed edits and blocks publish until retry succeeds", async () => {
    vi.useFakeTimers(); const state = vi.fn(); const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined); const publish = vi.fn();
    const queue = new EventDraftSaveQueue(save, state); queue.schedule("draft");
    await expect(queue.run(publish)).rejects.toThrow("offline"); expect(publish).not.toHaveBeenCalled(); expect(queue.dirty).toBe(true); expect(state).toHaveBeenLastCalledWith("error");
    await queue.run(publish); expect(save).toHaveBeenLastCalledWith("draft"); expect(publish).toHaveBeenCalledOnce(); expect(queue.dirty).toBe(false); queue.dispose();
  });
});
