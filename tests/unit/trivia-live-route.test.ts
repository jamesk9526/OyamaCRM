import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import trivia from "@/server/src/routes/trivia";

const db = vi.hoisted(() => ({
  triviaConfiguration: { findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  triviaAuditEvent: { create: vi.fn() },
  triviaRound: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: ((req, _res, next) => { Object.assign(req, { user: { orgId: "org-1" } }); next(); }) as RequestHandler }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => ((_req, _res, next) => next()) as RequestHandler }));

const app = express();
app.use(express.json());
app.use("/api/trivia", trivia);
let configuration: ReturnType<typeof fixture>;
function fixture() {
  return {
    id: "config-1", eventId: "event-1", legacyTriviaId: null as string | null, status: "live", hostName: "Host", payload: {},
    createdAt: new Date("2026-10-01T18:00:00Z"),
    updatedAt: new Date("2026-10-16T18:00:00Z"),
    event: { id: "event-1", organizationId: "org-1", name: "Trivia", location: "Hall", startDate: new Date("2026-10-16T18:00:00Z") },
    rounds: [{ id: "round-1", title: "Round", description: "", roundType: "normal", payload: {}, questions: [{ id: "question-1", prompt: "Question", answer: "Answer", points: 10, timerSeconds: 30, payload: {} }] }],
    teams: [{ id: "team-1", gameName: "Team", score: 0, bonusPoints: 0, sortOrder: 0, payload: {}, eventTableId: null }],
    scoreActions: [],
    liveState: { activeRoundId: "round-1", activeQuestionIndex: 0, stage: "question", timerDefaultSec: 30, timerRemainingSec: 30, timerRunning: false, updatedAt: "2026-10-16T18:00:00Z" },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  configuration = fixture();
  db.triviaConfiguration.findFirst.mockImplementation(async () => structuredClone(configuration));
  db.triviaConfiguration.updateMany.mockImplementation(async ({ data }) => { Object.assign(configuration, data); return { count: 1 }; });
  db.triviaAuditEvent.create.mockResolvedValue({});
  db.$transaction.mockImplementation(async (callback) => callback(db));
});

describe("event-scoped Trivia live transport", () => {
  it("scopes the read to the signed-in organization and excludes unrelated operational data", async () => {
    const response = await request(app).get("/api/trivia/events/event-1/live");
    expect(response.status).toBe(200);
    expect(response.body.event.rounds[0].questions[0].scoringAnswer).toBe("Answer");
    expect(response.body).toMatchObject({ live: { stage: "question" }, scoreHistory: [], revision: expect.any(String), serverNow: expect.any(String) });
    const query = db.triviaConfiguration.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ OR: [{ eventId: "event-1" }, { legacyTriviaId: "event-1" }], event: { organizationId: "org-1" } });
    expect(response.body.event).toMatchObject({ createdAt: "2026-10-01T18:00:00.000Z", updatedAt: "2026-10-16T18:00:00.000Z", scoringRules: { defaultQuestionPoints: 10 }, displaySettings: { showTimerOnQuestion: true, defaultStage: "welcome" } });
    expect(query.include).not.toHaveProperty("auditEvents");
    expect(query.include).not.toHaveProperty("accessPasses");
    expect(db.triviaConfiguration.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("returns 304 for an unchanged game, and changes revision when scores change", async () => {
    const initial = await request(app).get("/api/trivia/events/event-1/live");
    expect((await request(app).get("/api/trivia/events/event-1/live").set("If-None-Match", initial.headers.etag)).status).toBe(304);
    configuration.teams[0].score = 20;
    const changed = await request(app).get("/api/trivia/events/event-1/live").set("If-None-Match", initial.headers.etag);
    expect(changed.status).toBe(200);
    expect(changed.body.revision).not.toBe(initial.body.revision);
  });
  it("accepts a legacy route alias while returning and updating the canonical event", async () => {
    configuration.legacyTriviaId = "legacy-1";
    db.triviaConfiguration.findFirst.mockImplementation(async ({ where }) => where.event.organizationId === "org-1" && where.OR.some((key: { eventId?: string; legacyTriviaId?: string }) => key.eventId === configuration.eventId || key.legacyTriviaId === configuration.legacyTriviaId) ? structuredClone(configuration) : null);
    const initial = await request(app).get("/api/trivia/events/legacy-1/live");
    expect(initial.status).toBe(200);
    expect(initial.body.event.id).toBe("event-1");
    const saved = await request(app).patch("/api/trivia/events/legacy-1/live").send({ action: "set_stage", payload: { stage: "blank" }, expectedRevision: initial.body.revision });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ event: { id: "event-1" }, live: { stage: "blank" } });
    expect(db.triviaConfiguration.findFirst.mock.lastCall?.[0].where.OR[0]).toEqual({ eventId: "event-1" });
    expect((await request(app).get("/api/trivia/events/foreign-alias/live")).status).toBe(404);
  });
  it("rejects retired timer commands without writes", async () => {
    const deadline = new Date(Date.now() + 10_400).toISOString();
    Object.assign(configuration.liveState, { timerRunning: true, timerEndsAt: deadline });
    const response = await request(app).patch("/api/trivia/events/event-1/live").send({ action: "timer_start" });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("no longer supported");
    expect(db.triviaConfiguration.updateMany).not.toHaveBeenCalled();
    expect(db.triviaAuditEvent.create).not.toHaveBeenCalled();
  });
  it("persists one display command and audit without rebuilding game records", async () => {
    const initial = await request(app).get("/api/trivia/events/event-1/live");
    const response = await request(app).patch("/api/trivia/events/event-1/live").send({ action: "set_stage", payload: { stage: "answer" }, expectedRevision: initial.body.revision });
    expect(response.status).toBe(200);
    expect(response.body.live).toMatchObject({ stage: "answer", timerRunning: false, timerEndsAt: null });
    expect(db.triviaConfiguration.updateMany).toHaveBeenCalledOnce();
    expect(db.triviaAuditEvent.create).toHaveBeenCalledOnce();
    expect(db.triviaRound.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects stale host commands and returns authoritative state", async () => {
    const response = await request(app).patch("/api/trivia/events/event-1/live").send({ action: "set_stage", payload: { stage: "blank" }, expectedRevision: "stale" });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ live: { stage: "question" }, error: { code: "LIVE_CONFLICT" } });
    expect(db.triviaConfiguration.updateMany).not.toHaveBeenCalled();
  });
  it("detects a competing write between reading and saving and never records a false success audit", async () => {
    db.triviaConfiguration.updateMany.mockResolvedValue({ count: 0 });
    const response = await request(app).patch("/api/trivia/events/event-1/live").send({ action: "set_stage", payload: { stage: "blank" } });
    expect(response.status).toBe(409);
    expect(db.triviaAuditEvent.create).not.toHaveBeenCalled();
  });
  it("rejects arbitrary live snapshots and invalid command payloads", async () => {
    for (const body of [{ stage: "blank" }, { action: "set_question", payload: { questionIndex: 9 } }, { action: "set_winner", payload: { teamId: "foreign" } }, { action: "timer_reset", payload: { seconds: -1 } }]) {
      expect((await request(app).patch("/api/trivia/events/event-1/live").send(body)).status).toBe(400);
    }
    expect(db.triviaConfiguration.updateMany).not.toHaveBeenCalled();
  });
  it("expires a deadline timer on read without any database writes", async () => {
    Object.assign(configuration.liveState, { timerRunning: true, timerEndsAt: "2026-01-01T00:00:00Z" });
    const response = await request(app).get("/api/trivia/events/event-1/live");
    expect(response.body.live).toMatchObject({ timerRunning: false, timerRemainingSec: 0, timerEndsAt: null });
    expect(db.triviaConfiguration.updateMany).not.toHaveBeenCalled();
  });
  it("returns 404 for a missing or foreign event instead of inventing live state", async () => {
    db.triviaConfiguration.findFirst.mockResolvedValue(null);
    expect((await request(app).get("/api/trivia/events/other/live")).status).toBe(404);
    expect((await request(app).patch("/api/trivia/events/other/live").send({ action: "timer_pause" })).status).toBe(404);
  });
});
