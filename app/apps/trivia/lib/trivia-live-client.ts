import { apiFetchResponse } from "@/app/lib/auth-client";
import { ensureLiveStateCoverage } from "./trivia-store";
import type { TriviaConnectionStatus, TriviaEvent, TriviaLiveState, TriviaScoreAction } from "./trivia-types";

export interface TriviaLiveSnapshot {
  event: TriviaEvent;
  live: TriviaLiveState;
  revision: string;
  serverNow: string;
  scoreHistory?: TriviaScoreAction[];
}

export type TriviaLiveCommand = "set_stage" | "set_round" | "set_question" | "timer_start" | "timer_pause" | "timer_reset" | "set_winner" | "projector_opened" | "set_status" | "next_question" | "previous_question";

export interface TriviaLiveClientState {
  snapshot: TriviaLiveSnapshot | null;
  connectionStatus: TriviaConnectionStatus;
  saving: boolean;
  error: string | null;
  clockOffsetMs: number;
}

interface LiveChannel {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(value: unknown): void;
  close(): void;
}

interface ClientOptions {
  request?: typeof apiFetchResponse;
  createChannel?: (name: string) => LiveChannel | null;
  onChange?: (state: TriviaLiveClientState) => void;
}

export const EMPTY_TRIVIA_LIVE_STATE: TriviaLiveClientState = {
  snapshot: null, connectionStatus: "reconnecting", saving: false, error: null, clockOffsetMs: 0,
};

function isSnapshot(value: unknown): value is TriviaLiveSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<TriviaLiveSnapshot>;
  return Boolean(snapshot.event?.id && snapshot.live?.updatedAt && typeof snapshot.revision === "string" && typeof snapshot.serverNow === "string");
}

function snapshotTime(snapshot: TriviaLiveSnapshot): number {
  return Math.max(Date.parse(snapshot.live.updatedAt) || 0, Date.parse(snapshot.event.updatedAt) || 0);
}

function matchesEvent(snapshot: TriviaLiveSnapshot, eventId: string): boolean {
  return snapshot.event.id === eventId || snapshot.event.legacyTriviaId === eventId;
}

function normalizeSnapshot(snapshot: TriviaLiveSnapshot): TriviaLiveSnapshot {
  const eventId = snapshot.event.id;
  const normalized = ensureLiveStateCoverage({
    events: [snapshot.event], liveByEventId: { [eventId]: snapshot.live },
    scoreHistoryByEventId: { [eventId]: snapshot.scoreHistory ?? [] },
  });
  return {
    ...snapshot,
    event: normalized.events[0], live: normalized.liveByEventId[eventId],
    ...(snapshot.scoreHistory ? { scoreHistory: normalized.scoreHistoryByEventId[eventId] } : {}),
  };
}

async function readSnapshot(response: Response, eventId: string): Promise<TriviaLiveSnapshot> {
  const body: unknown = await response.json();
  const value = body && typeof body === "object" && "data" in body ? body.data : body;
  if (!isSnapshot(value)) throw new Error("The live game returned an incomplete response. Retry synchronization.");
  if (!matchesEvent(value, eventId)) throw new Error("The live game returned a different event. Retry synchronization.");
  return normalizeSnapshot(value);
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  return new Error(body?.error?.message || (response.status === 401 ? "Your session expired. Please sign in again." : `Live game request failed (${response.status}).`));
}

/** One event's serialized host commands and non-overlapping, conditional live reads. */
export class TriviaLiveClient {
  private state: TriviaLiveClientState = { ...EMPTY_TRIVIA_LIVE_STATE };
  private readonly request: typeof apiFetchResponse;
  private readonly endpoint: string;
  private channel: LiveChannel | null = null;
  private stopped = false;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readInFlight: Promise<void> | null = null;
  private readonly controllers = new Set<AbortController>();
  private generation = 0;
  private failedCommandGeneration = 0;
  private commandCount = 0;
  private commandQueue: Promise<unknown> = Promise.resolve();
  private etag: string | null = null;

  constructor(private readonly eventId: string, private readonly options: ClientOptions = {}) {
    this.request = options.request ?? apiFetchResponse;
    this.endpoint = `/api/apps/trivia/events/${encodeURIComponent(eventId)}/live`;
    try {
      this.channel = options.createChannel ? options.createChannel(`oyama-trivia-live:${eventId}`) : typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`oyama-trivia-live:${eventId}`) : null;
      if (this.channel) this.channel.onmessage = (message) => this.receiveBroadcast(message.data);
    } catch { /* Conditional polling remains available when browser channels are disabled. */ }
  }

  getState = (): TriviaLiveClientState => this.state;

  private update(patch: Partial<TriviaLiveClientState>) {
    if (this.stopped) return;
    this.state = { ...this.state, ...patch };
    this.options.onChange?.(this.state);
  }

  private apply(snapshot: TriviaLiveSnapshot, serverResponse: boolean) {
    if (!matchesEvent(snapshot, this.eventId) || this.stopped) return;
    this.generation += 1;
    this.etag = `"${snapshot.revision}"`;
    const clockOffsetMs = Date.parse(snapshot.serverNow) - Date.now();
    this.update({ snapshot, ...(serverResponse ? { connectionStatus: "connected" as const, ...(Number.isFinite(clockOffsetMs) ? { clockOffsetMs } : {}) } : {}) });
  }

  private receiveBroadcast(value: unknown) {
    if (this.stopped || !isSnapshot(value) || !matchesEvent(value, this.eventId)) return;
    const current = this.state.snapshot;
    if (current?.revision === value.revision) return;
    const incomingTime = snapshotTime(value);
    const currentTime = current ? snapshotTime(current) : -Infinity;
    if (incomingTime > currentTime) {
      try { this.apply(normalizeSnapshot(value), false); } catch { /* Verify malformed channel hints with the server below. */ }
    }
    // A channel is an immediate hint, never proof of the current server state or clock.
    // Invalidate an older in-flight GET before measuring against an unconditional read.
    this.generation += 1;
    this.etag = null;
    const pending = this.readInFlight;
    void (pending ?? Promise.resolve()).then(() => this.read(false));
  }

  start() {
    if (this.started || this.stopped) return;
    this.started = true;
    void this.read(false).then(() => this.schedule());
  }

  private schedule() {
    if (!this.started || this.stopped) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.read(false).then(() => this.schedule());
    }, 1000);
  }

  refresh = async (): Promise<void> => {
    // An explicit retry always obtains authoritative state, even after a channel hint.
    this.etag = null;
    if (this.readInFlight) await this.readInFlight;
    await this.read(true);
  };

  private read(clearError: boolean): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.readInFlight) return this.readInFlight;
    const controller = new AbortController();
    this.controllers.add(controller);
    const generation = this.generation;
    const headers = this.etag ? { "If-None-Match": this.etag } : undefined;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    this.readInFlight = (async () => {
      try {
        const response = await this.request(this.endpoint, { method: "GET", headers, cache: "no-store", signal: controller.signal });
        if (this.stopped || generation !== this.generation) return;
        if (response.status === 304) {
          this.update({ connectionStatus: "connected", ...(clearError ? { error: null } : {}) });
          return;
        }
        if (!response.ok) throw await responseError(response);
        const snapshot = await readSnapshot(response, this.eventId);
        if (generation !== this.generation) return;
        this.apply(snapshot, true);
        this.etag = response.headers.get("etag") ?? this.etag;
        if (clearError) this.update({ error: null });
      } catch (error) {
        if (!this.stopped && generation === this.generation) this.update({ connectionStatus: "offline", error: controller.signal.aborted ? "Live game synchronization timed out. Retry synchronization." : error instanceof Error ? error.message : "Unable to synchronize the live game." });
      } finally {
        clearTimeout(timeout);
        this.controllers.delete(controller);
        this.readInFlight = null;
      }
    })();
    return this.readInFlight;
  }

  sendCommand = (action: TriviaLiveCommand, payload?: Record<string, unknown>): Promise<boolean> => {
    if (this.stopped) return Promise.resolve(false);
    const commandGeneration = this.failedCommandGeneration;
    this.commandCount += 1;
    this.update({ saving: true });
    const result = this.commandQueue.then(async () => {
      if (this.stopped || commandGeneration !== this.failedCommandGeneration) return false;
      const controller = new AbortController();
      this.controllers.add(controller);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        if (!this.state.snapshot) await this.refresh();
        if (this.stopped) return false;
        if (!this.state.snapshot) throw new Error("Connect to the live game before sending controls.");
        timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await this.request(this.endpoint, {
          method: "PATCH", signal: controller.signal,
          body: JSON.stringify({ action, payload, expectedRevision: this.state.snapshot.revision }),
        });
        if (this.stopped) return false;
        if (response.status === 409) {
          this.failedCommandGeneration += 1;
          await this.refresh();
          this.update({ error: "The game changed in another control window. The latest state is loaded; review it before trying again." });
          return false;
        }
        if (!response.ok) throw await responseError(response);
        const snapshot = await readSnapshot(response, this.eventId);
        if (this.stopped) return false;
        const current = this.state.snapshot;
        if (current && current.revision !== snapshot.revision && snapshotTime(current) >= snapshotTime(snapshot)) {
          // A different host may have advanced again while this successful ACK traveled.
          // Never rewind the projector to that earlier successful command.
          await this.refresh();
        } else {
          this.apply(snapshot, true);
        }
        this.update({ error: null });
        try { this.channel?.postMessage(snapshot); } catch { /* The server acknowledgement is already durable. */ }
        return true;
      } catch (error) {
        this.failedCommandGeneration += 1;
        this.update({ connectionStatus: "offline", error: controller.signal.aborted ? "The host control timed out. Refresh to check the game before retrying." : error instanceof Error ? error.message : "Unable to save the host control. Refresh before retrying." });
        return false;
      } finally {
        if (timeout) clearTimeout(timeout);
        this.controllers.delete(controller);
      }
    }).finally(() => {
      this.commandCount -= 1;
      this.update({ saving: this.commandCount > 0 });
    });
    this.commandQueue = result;
    return result;
  };

  dispose() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.channel?.close();
    this.channel = null;
  }
}
