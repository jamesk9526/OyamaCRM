import express, { type RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import trivia from "@/server/src/routes/trivia";

const db = vi.hoisted(() => ({
  event: { findMany: vi.fn(), findFirst: vi.fn() },
  triviaConfiguration: { findMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  event: { findFirst: vi.fn() }, eventTable: { findMany: vi.fn() },
  triviaConfiguration: { updateMany: vi.fn(), upsert: vi.fn() },
  triviaRound: { deleteMany: vi.fn(), create: vi.fn() },
  triviaTeam: { deleteMany: vi.fn(), create: vi.fn() },
  triviaScoreAction: { deleteMany: vi.fn(), create: vi.fn() },
  triviaSnapshot: { deleteMany: vi.fn(), create: vi.fn() },
  triviaAuditEvent: { deleteMany: vi.fn(), create: vi.fn() },
  triviaAccessPass: { deleteMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/server/src/lib/prisma", () => ({ prisma: db }));
vi.mock("node:fs/promises", async (original) => ({ ...await original<object>(), readFile: vi.fn().mockRejectedValue(new Error("No legacy file")) }));
vi.mock("@/server/src/middleware/requireAuth", () => ({ requireAuth: ((req, _res, next) => { Object.assign(req, { user: { orgId: "org-1" } }); next(); }) as RequestHandler }));
vi.mock("@/server/src/middleware/requirePermission", () => ({ requirePermission: () => ((_req, _res, next) => next()) as RequestHandler }));
const app = express();
app.use(express.json());
app.use("/api/trivia", trivia);
app.use((_error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(500).json({ error: "Save failed" }); });
function configuration() {
  return {
    id: "config", eventId: "event", payload: {}, legacyTriviaId: null, status: "draft", hostName: "Host",
    event: { id: "event", organizationId: "org-1", name: "Night", location: "Hall", startDate: new Date("2026-10-17") },
    updatedAt: new Date("2026-10-17"), rounds: [], scoreActions: [], snapshots: [], auditEvents: [], accessPasses: [],
    teams: [{ id: "team", gameName: "Team", score: 15, bonusPoints: 0, sortOrder: 0, eventTableId: null, payload: { tableNumber: "1" } }],
    liveState: { updatedAt: "2026-10-17T00:00:00.000Z" },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  db.triviaConfiguration.findMany.mockImplementation(async () => [configuration()]);
  db.event.findMany.mockResolvedValue([]);
  db.event.findFirst.mockResolvedValue({ id: "event", name: "Night", location: "Hall", tables: [] });
  tx.event.findFirst.mockResolvedValue({ id: "event" });
  tx.eventTable.findMany.mockResolvedValue([]);
  tx.triviaConfiguration.upsert.mockResolvedValue({ id: "config" });
  tx.triviaTeam.create.mockResolvedValue({ id: "team" });
  db.$transaction.mockImplementation(async (callback) => callback(tx));
});
describe("Trivia state read and replacement", () => {
  it("concurrent roster reads never delete or insert teams", async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).get("/api/trivia/state")));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect(responses[0].body.state.events[0].teams[0].score).toBe(15);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.triviaTeam.deleteMany).not.toHaveBeenCalled();
    expect(tx.triviaTeam.create).not.toHaveBeenCalled();
  });
  it("replaces game rows using a single serializable transaction", async () => {
    const initial = await request(app).get("/api/trivia/state");
    const response = await request(app).put("/api/trivia/state").send({ state: initial.body.state });
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
    expect(tx.triviaTeam.deleteMany).toHaveBeenCalledWith({ where: { configurationId: "config" } });
    expect(tx.triviaTeam.create.mock.calls[0][0].data).toMatchObject({ id: "team", score: 15 });
  });
  it("propagates insert failures through the transaction instead of acknowledging a partial save", async () => {
    const initial = await request(app).get("/api/trivia/state");
    tx.triviaTeam.create.mockRejectedValueOnce(new Error("Duplicate primary key"));
    const response = await request(app).put("/api/trivia/state").send({ state: initial.body.state });
    expect(response.status).toBe(500);
    expect(db.triviaConfiguration.deleteMany).not.toHaveBeenCalled();
  });
});
