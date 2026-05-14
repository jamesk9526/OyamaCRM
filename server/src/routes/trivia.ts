/**
 * Oyama Trivia standalone API routes.
 * Stores module state per organization in a JSON file for night-of operations recovery.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { type Request } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
router.use(requireAuth);

type JsonObject = Record<string, unknown>;

interface StoreShape {
  organizations: Record<string, OrganizationTriviaStore>;
}

interface OrganizationTriviaStore {
  state: JsonObject;
  snapshotsByEventId: Record<string, JsonObject[]>;
  auditByEventId: Record<string, JsonObject[]>;
  updatedAt: string;
}

const STORE_DIR = path.resolve(process.cwd(), "server", ".data");
const STORE_FILE = path.join(STORE_DIR, "trivia-store.json");

let storeCache: StoreShape | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveOrganizationId(req: Request): string {
  const orgId = typeof req.user?.orgId === "string" ? req.user.orgId.trim() : "";
  return orgId || "default-org";
}

function createEmptyState(): JsonObject {
  return {
    events: [],
    liveByEventId: {},
    scoreHistoryByEventId: {},
  };
}

function ensureOrgStore(store: StoreShape, organizationId: string): OrganizationTriviaStore {
  if (store.organizations[organizationId]) return store.organizations[organizationId];

  const created: OrganizationTriviaStore = {
    state: createEmptyState(),
    snapshotsByEventId: {},
    auditByEventId: {},
    updatedAt: nowIso(),
  };
  store.organizations[organizationId] = created;
  return created;
}

async function loadStore(): Promise<StoreShape> {
  if (storeCache) return storeCache;

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isObject(parsed) && isObject(parsed.organizations)) {
      storeCache = { organizations: parsed.organizations as StoreShape["organizations"] };
    } else {
      storeCache = { organizations: {} };
    }
  } catch {
    storeCache = { organizations: {} };
  }

  return storeCache;
}

async function persistStore(store: StoreShape): Promise<void> {
  storeCache = store;
  writeQueue = writeQueue.then(async () => {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  });
  await writeQueue;
}

function pushAudit(orgStore: OrganizationTriviaStore, eventId: string, type: string, message: string, metadata?: JsonObject) {
  const existing = orgStore.auditByEventId[eventId] ?? [];
  orgStore.auditByEventId[eventId] = [
    {
      id: `audit-${randomUUID().slice(0, 12)}`,
      eventId,
      type,
      message,
      createdAt: nowIso(),
      metadata: metadata ?? {},
    },
    ...existing,
  ].slice(0, 500);
}

function getStateEvents(orgStore: OrganizationTriviaStore): JsonObject[] {
  const maybeState = orgStore.state;
  const events = isObject(maybeState) && Array.isArray(maybeState.events) ? maybeState.events : [];
  return events.filter(isObject);
}

function setStateEvents(orgStore: OrganizationTriviaStore, events: JsonObject[]) {
  if (!isObject(orgStore.state)) {
    orgStore.state = createEmptyState();
  }
  orgStore.state.events = events;
}

function getStateRecord(orgStore: OrganizationTriviaStore, key: string): Record<string, unknown> {
  if (!isObject(orgStore.state) || !isObject(orgStore.state[key])) {
    if (!isObject(orgStore.state)) orgStore.state = createEmptyState();
    orgStore.state[key] = {};
  }
  return orgStore.state[key] as Record<string, unknown>;
}

function getScoreHistory(orgStore: OrganizationTriviaStore, eventId: string): JsonObject[] {
  const scoreById = getStateRecord(orgStore, "scoreHistoryByEventId");
  const history = scoreById[eventId];
  return Array.isArray(history) ? history.filter(isObject) : [];
}

function setScoreHistory(orgStore: OrganizationTriviaStore, eventId: string, history: JsonObject[]) {
  const scoreById = getStateRecord(orgStore, "scoreHistoryByEventId");
  scoreById[eventId] = history;
}

function getLive(orgStore: OrganizationTriviaStore, eventId: string): JsonObject {
  const liveById = getStateRecord(orgStore, "liveByEventId");
  if (!isObject(liveById[eventId])) {
    liveById[eventId] = {
      activeRoundId: "",
      activeQuestionIndex: 0,
      stage: "welcome",
      timerDefaultSec: 30,
      timerRemainingSec: 30,
      timerRunning: false,
      leaderboardVisible: false,
      answerRevealed: false,
      displayOpenedAt: null,
      winnerTeamId: null,
      lastHostAction: "Ready",
      updatedAt: nowIso(),
    };
  }
  return liveById[eventId] as JsonObject;
}

function setLive(orgStore: OrganizationTriviaStore, eventId: string, value: JsonObject) {
  const liveById = getStateRecord(orgStore, "liveByEventId");
  liveById[eventId] = value;
}

router.get("/state", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  res.json({ state: orgStore.state, updatedAt: orgStore.updatedAt });
});

router.put("/state", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  orgStore.state = isObject(req.body?.state) ? clone(req.body.state) : createEmptyState();
  orgStore.updatedAt = nowIso();
  await persistStore(store);
  res.json({ state: orgStore.state, updatedAt: orgStore.updatedAt });
});

router.get("/events", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  res.json({ events: getStateEvents(orgStore) });
});

router.post("/events", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const events = getStateEvents(orgStore);
  const now = nowIso();
  const incoming = isObject(req.body) ? clone(req.body) : {};
  const eventId = typeof incoming.id === "string" && incoming.id.trim() ? incoming.id : `trivia-event-${randomUUID().slice(0, 12)}`;

  const nextEvent: JsonObject = {
    ...incoming,
    id: eventId,
    rounds: Array.isArray(incoming.rounds) ? incoming.rounds : [],
    teams: Array.isArray(incoming.teams) ? incoming.teams : [],
    createdAt: typeof incoming.createdAt === "string" ? incoming.createdAt : now,
    updatedAt: now,
  };

  const idx = events.findIndex((event) => event.id === eventId);
  if (idx >= 0) events[idx] = nextEvent;
  else events.unshift(nextEvent);

  setStateEvents(orgStore, events);
  getLive(orgStore, eventId);
  if (!orgStore.snapshotsByEventId[eventId]) orgStore.snapshotsByEventId[eventId] = [];
  if (!orgStore.auditByEventId[eventId]) orgStore.auditByEventId[eventId] = [];
  if (getScoreHistory(orgStore, eventId).length === 0) setScoreHistory(orgStore, eventId, []);

  orgStore.updatedAt = now;
  pushAudit(orgStore, eventId, "manual", "Event created or updated");
  await persistStore(store);
  res.status(idx >= 0 ? 200 : 201).json({ event: nextEvent });
});

router.get("/events/:eventId", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  res.json({ event, live: getLive(orgStore, eventId), scoreHistory: getScoreHistory(orgStore, eventId) });
});

router.patch("/events/:eventId", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const events = getStateEvents(orgStore);
  const idx = events.findIndex((item) => item.id === eventId);

  if (idx < 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  const current = events[idx];
  const patch = isObject(req.body) ? req.body : {};
  const nextEvent: JsonObject = { ...current, ...patch, id: eventId, updatedAt: nowIso() };
  events[idx] = nextEvent;
  setStateEvents(orgStore, events);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "status", "Event updated");
  await persistStore(store);
  res.json({ event: nextEvent });
});

router.get("/events/:eventId/live", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  res.json({ live: getLive(orgStore, String(req.params.eventId ?? "")) });
});

router.patch("/events/:eventId/live", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const patch = isObject(req.body) ? req.body : {};
  const current = getLive(orgStore, eventId);
  const merged = { ...current, ...patch, updatedAt: nowIso() };
  setLive(orgStore, eventId, merged);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "manual", "Live state updated");
  await persistStore(store);
  res.json({ live: merged });
});

router.post("/events/:eventId/score-actions", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const payload = isObject(req.body) ? req.body : {};
  const action = {
    id: `score-action-${randomUUID().slice(0, 12)}`,
    eventId,
    teamId: String(payload.teamId ?? ""),
    roundId: typeof payload.roundId === "string" ? payload.roundId : null,
    questionId: typeof payload.questionId === "string" ? payload.questionId : null,
    actionType: typeof payload.actionType === "string" ? payload.actionType : "manual",
    delta: Number.isFinite(payload.delta) ? Number(payload.delta) : 0,
    reason: typeof payload.reason === "string" ? payload.reason : "Manual score adjustment",
    previousScore: Number.isFinite(payload.previousScore) ? Number(payload.previousScore) : 0,
    newScore: Number.isFinite(payload.newScore) ? Number(payload.newScore) : 0,
    createdAt: nowIso(),
  };

  const history = getScoreHistory(orgStore, eventId);
  setScoreHistory(orgStore, eventId, [...history, action]);

  const live = getLive(orgStore, eventId);
  setLive(orgStore, eventId, {
    ...live,
    lastHostAction: action.reason,
    lastScoreActionAt: action.createdAt,
    lastScoreActionSummary: `${action.actionType} ${action.delta >= 0 ? `+${action.delta}` : action.delta} (${action.reason})`,
    updatedAt: nowIso(),
  });

  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "score", `Score action ${action.id}`, { teamId: String(action.teamId) });
  await persistStore(store);
  res.status(201).json({ action });
});

router.post("/events/:eventId/score-actions/:actionId/undo", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const actionId = String(req.params.actionId ?? "");

  const history = getScoreHistory(orgStore, eventId);
  const next = history.filter((entry) => entry.id !== actionId);
  if (next.length === history.length) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Score action not found." } });
    return;
  }

  setScoreHistory(orgStore, eventId, next);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "score", `Undid score action ${actionId}`);
  await persistStore(store);
  res.json({ ok: true });
});

router.get("/events/:eventId/audit", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  res.json({ audit: orgStore.auditByEventId[eventId] ?? [] });
});

router.post("/events/:eventId/snapshot", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const events = getStateEvents(orgStore);
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  const snapshot = {
    id: `snapshot-${randomUUID().slice(0, 12)}`,
    eventId,
    label: typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim() : "Manual snapshot",
    capturedAt: nowIso(),
    event: clone(event),
    live: clone(getLive(orgStore, eventId)),
    scoreHistory: clone(getScoreHistory(orgStore, eventId)),
  };

  const previous = orgStore.snapshotsByEventId[eventId] ?? [];
  orgStore.snapshotsByEventId[eventId] = [snapshot, ...previous].slice(0, 100);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "snapshot", `Snapshot created: ${snapshot.label}`, { snapshotId: snapshot.id });
  await persistStore(store);
  res.status(201).json({ snapshot });
});

router.get("/events/:eventId/snapshots", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  res.json({ snapshots: orgStore.snapshotsByEventId[eventId] ?? [] });
});

router.post("/events/:eventId/recover", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const snapshotId = String(req.body?.snapshotId ?? "").trim();

  if (!snapshotId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "snapshotId is required." } });
    return;
  }

  const snapshots = orgStore.snapshotsByEventId[eventId] ?? [];
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot || !isObject(snapshot.event) || !isObject(snapshot.live) || !Array.isArray(snapshot.scoreHistory)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found." } });
    return;
  }

  const events = getStateEvents(orgStore);
  const idx = events.findIndex((item) => item.id === eventId);
  if (idx >= 0) events[idx] = clone(snapshot.event as JsonObject);
  else events.unshift(clone(snapshot.event as JsonObject));
  setStateEvents(orgStore, events);
  setLive(orgStore, eventId, clone(snapshot.live as JsonObject));
  setScoreHistory(orgStore, eventId, clone(snapshot.scoreHistory as JsonObject[]));

  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "recover", `Recovered snapshot ${snapshotId}`, { snapshotId });
  await persistStore(store);
  res.json({ state: orgStore.state, recoveredSnapshotId: snapshotId });
});

export default router;
