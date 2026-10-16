import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/lib/auth-client", () => ({ apiFetchResponse: vi.fn() }));
import { TriviaLiveClient, type TriviaLiveSnapshot } from "@/app/apps/trivia/lib/trivia-live-client";
import { createSampleTriviaEvent } from "@/app/apps/trivia/lib/trivia-sample-data";
import { createDefaultLiveState } from "@/app/apps/trivia/lib/trivia-demo-data";

function snapshot(revision = "1", seconds = 10): TriviaLiveSnapshot {
  const event = createSampleTriviaEvent("event");
  event.id = "event";
  event.updatedAt = "2026-10-16T00:00:00.000Z";
  return { event, live: { ...createDefaultLiveState(event), timerRemainingSec: seconds, updatedAt: `2026-10-16T00:00:0${revision}.000Z` }, revision, serverNow: new Date().toISOString() };
}
const response = (value: TriviaLiveSnapshot) => Response.json({ data: value });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
afterEach(() => { vi.useRealTimers(); });

describe("Trivia live transport", () => {
  it("normalizes minimal server events and questions before projector rendering without changing revisions or deadlines", async () => {
    const raw = {
      event: { id: "event", name: "Tonight", rounds: [{ id: "round", questions: [{ id: "question", prompt: "Ready?" }] }], updatedAt: "2026-10-16T00:00:00.000Z" },
      live: { updatedAt: "2026-10-16T00:00:01.000Z", timerRunning: true, timerEndsAt: "2026-10-16T00:01:01.000Z" },
      revision: "raw-server-revision", serverNow: "2026-10-16T00:00:01.000Z",
    };
    const client = new TriviaLiveClient("event", { request: vi.fn().mockResolvedValue(Response.json(raw)), createChannel: () => null });
    await client.refresh();
    const saved = client.getState().snapshot;
    expect(saved?.event.teams).toEqual([]);
    expect(saved?.event.rounds[0].questions[0].options).toEqual([]);
    expect(saved?.event.displaySettings.defaultStage).toBe("welcome");
    expect(saved?.event.scoringRules.defaultQuestionPoints).toBe(10);
    expect(saved?.live.activeRoundId).toBe("round");
    expect(saved?.live.timerEndsAt).toBe(raw.live.timerEndsAt);
    expect(saved?.revision).toBe(raw.revision);
    client.dispose();
  });

  it("accepts canonical responses for a requested legacy event alias", async () => {
    const canonical = snapshot();
    canonical.event.legacyTriviaId = "old-trivia-id";
    const request = vi.fn().mockImplementation(() => Promise.resolve(response(canonical)));
    const client = new TriviaLiveClient("old-trivia-id", { request, createChannel: () => null });
    await client.refresh();
    expect(client.getState().snapshot?.event.id).toBe("event");
    expect(client.getState().connectionStatus).toBe("connected");
    expect(await client.sendCommand("projector_opened")).toBe(true);
    expect(request.mock.calls[0][0]).toBe("/api/apps/trivia/events/old-trivia-id/live");
    client.dispose();
  });

  it("polls one second after completion without overlapping slow requests", async () => {
    vi.useFakeTimers();
    const slow = deferred<Response>();
    const request = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValue(new Response(null, { status: 304 }));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    client.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(1);
    slow.resolve(response(snapshot()));
    await vi.advanceTimersByTimeAsync(999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(new Headers(request.mock.calls[1][1].headers).get("If-None-Match")).toBe('"1"');
    client.dispose();
  });

  it("does not let an older GET overwrite an acknowledged host command", async () => {
    const slow = deferred<Response>();
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(response(snapshot("2", 20)));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    await client.refresh();
    const poll = client.refresh();
    expect(await client.sendCommand("timer_reset", { seconds: 20 })).toBe(true);
    slow.resolve(response(snapshot()));
    await poll;
    expect(client.getState().snapshot?.live.timerRemainingSec).toBe(20);
    client.dispose();
  });

  it("serializes commands against the preceding acknowledged revision", async () => {
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockResolvedValueOnce(response(snapshot("2"))).mockResolvedValueOnce(response(snapshot("3")));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    await client.refresh();
    await Promise.all([client.sendCommand("next_question"), client.sendCommand("timer_start")]);
    expect(JSON.parse(request.mock.calls[1][1].body).expectedRevision).toBe("1");
    expect(JSON.parse(request.mock.calls[2][1].body).expectedRevision).toBe("2");
    client.dispose();
  });

  it("refreshes a conflicting command without replaying it or queued commands", async () => {
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockResolvedValueOnce(Response.json({ error: { message: "conflict" } }, { status: 409 })).mockResolvedValueOnce(response(snapshot("2")));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    await client.refresh();
    expect(await Promise.all([client.sendCommand("next_question"), client.sendCommand("next_question")])).toEqual([false, false]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(client.getState().snapshot?.revision).toBe("2");
    expect(client.getState().error).toContain("another control");
    client.dispose();
  });

  it("shows failures and allows an explicit refresh to recover", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce(response(snapshot()));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    await client.refresh();
    expect(client.getState().connectionStatus).toBe("offline");
    expect(client.getState().error).toContain("Network unavailable");
    await client.refresh();
    expect(client.getState().connectionStatus).toBe("connected");
    expect(client.getState().error).toBeNull();
    client.dispose();
  });

  it("aborts requests and ignores late responses after disposal", async () => {
    const slow = deferred<Response>();
    const request = vi.fn().mockReturnValue(slow.promise);
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    const refresh = client.refresh();
    client.dispose();
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    slow.resolve(response(snapshot()));
    await refresh;
    expect(client.getState().snapshot).toBeNull();
  });

  it("publishes only acknowledged commands to the projector channel", async () => {
    const channel = { onmessage: null, postMessage: vi.fn(), close: vi.fn() };
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockResolvedValueOnce(response(snapshot("2"))).mockRejectedValueOnce(new Error("offline"));
    const client = new TriviaLiveClient("event", { request, createChannel: () => channel });
    await client.refresh();
    expect(await client.sendCommand("set_stage", { stage: "question" })).toBe(true);
    expect(channel.postMessage.mock.calls[0][0].revision).toBe("2");
    expect(await client.sendCommand("set_stage", { stage: "answer" })).toBe(false);
    expect(channel.postMessage).toHaveBeenCalledTimes(1);
    client.dispose();
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it("times out a stalled read so polling and manual recovery can continue", async () => {
    vi.useFakeTimers();
    const request = vi.fn((_path: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const client = new TriviaLiveClient("event", { request, createChannel: () => null });
    client.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getState().error).toContain("timed out");
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it("shows a newer broadcast immediately, ignores old broadcasts and verifies against the server", async () => {
    const channel: { onmessage: ((event: MessageEvent) => void) | null; postMessage: (value: unknown) => void; close: () => void } = { onmessage: null, postMessage: vi.fn(), close: vi.fn() };
    const slow = deferred<Response>();
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockReturnValueOnce(slow.promise).mockResolvedValueOnce(response(snapshot("3", 30)));
    const client = new TriviaLiveClient("event", { request, createChannel: () => channel });
    await client.refresh();
    const offset = client.getState().clockOffsetMs;
    const currentRead = client.refresh();
    channel.onmessage?.({ data: snapshot("2", 20) } as MessageEvent);
    expect(client.getState().snapshot?.revision).toBe("2");
    expect(client.getState().clockOffsetMs).toBe(offset);
    channel.onmessage?.({ data: snapshot("1", 10) } as MessageEvent);
    expect(client.getState().snapshot?.revision).toBe("2");
    slow.resolve(response(snapshot("1")));
    await currentRead;
    await new Promise((done) => setTimeout(done, 0));
    expect(client.getState().snapshot?.revision).toBe("3");
    client.dispose();
  });

  it("does not rewind a newer projector state when an earlier successful command ACK arrives late", async () => {
    const channel: { onmessage: ((event: MessageEvent) => void) | null; postMessage: (value: unknown) => void; close: () => void } = { onmessage: null, postMessage: vi.fn(), close: vi.fn() };
    const delayedAck = deferred<Response>();
    const request = vi.fn().mockResolvedValueOnce(response(snapshot())).mockReturnValueOnce(delayedAck.promise).mockImplementation(() => Promise.resolve(response(snapshot("3", 30))));
    const seen: string[] = [];
    const client = new TriviaLiveClient("event", { request, createChannel: () => channel, onChange: (state) => { if (state.snapshot) seen.push(state.snapshot.revision); } });
    await client.refresh();
    const command = client.sendCommand("timer_reset", { seconds: 20 });
    await Promise.resolve();
    channel.onmessage?.({ data: snapshot("3", 30) } as MessageEvent);
    delayedAck.resolve(response(snapshot("2", 20)));
    expect(await command).toBe(true);
    expect(client.getState().snapshot?.revision).toBe("3");
    expect(seen).not.toContain("2");
    client.dispose();
  });
});
