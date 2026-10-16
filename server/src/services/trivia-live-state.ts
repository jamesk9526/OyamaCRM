import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { applyRemoteTriviaHostAction, resolveTriviaTimer } from "./trivia-host-control.js";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const include = {
  event: { select: { id: true, organizationId: true, name: true, location: true, startDate: true } },
  rounds: { orderBy: { sortOrder: "asc" as const }, include: { questions: { orderBy: { sortOrder: "asc" as const } } } },
  teams: { orderBy: { sortOrder: "asc" as const } },
  scoreActions: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.TriviaConfigurationInclude;

/** A live read deliberately excludes snapshots, audits, passes, and roster synchronization. */
export async function readTriviaLive(organizationId: string, eventId: string) {
  const configuration = await prisma.triviaConfiguration.findFirst({ where: { OR: [{ eventId }, { legacyTriviaId: eventId }], event: { organizationId } }, include });
  if (!configuration) return null;
  const payload = object(configuration.payload);
  const event: JsonObject = {
    ...payload, id: configuration.eventId, legacyTriviaId: configuration.legacyTriviaId ?? undefined,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : configuration.createdAt.toISOString(),
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : configuration.updatedAt.toISOString(),
    scoringRules: { defaultQuestionPoints: 10, allowPartialCredit: true, allowNegativeScores: false, finalWagerEnabled: true, tieBreakerMode: "single_question", ...object(payload.scoringRules) },
    displaySettings: { highContrast: true, showTeamColors: true, showTimerOnQuestion: true, defaultStage: "welcome", ...object(payload.displaySettings) },
    name: configuration.event.name, venue: configuration.event.location ?? "", startAt: configuration.event.startDate.toISOString(),
    hostName: configuration.hostName ?? "", status: configuration.status, linkedEventsEventId: configuration.eventId,
    linkedEventsEventName: configuration.event.name, eventsSyncMode: "automatic",
    rounds: configuration.rounds.map(round => ({
      ...object(round.payload), id: round.id, title: round.title, description: round.description ?? "", roundType: round.roundType,
      questions: round.questions.map(question => ({ ...object(question.payload), id: question.id, prompt: question.prompt, scoringAnswer: question.answer, points: question.points, timeLimitSec: question.timerSeconds })),
    })),
    teams: configuration.teams.map(team => ({ ...object(team.payload), id: team.id, name: team.gameName ?? String(object(team.payload).name ?? "Team"), score: team.score, bonusPoints: team.bonusPoints, sortOrder: team.sortOrder, eventsTableId: team.eventTableId ?? undefined })),
  };
  const live: JsonObject = {
    activeRoundId: "", activeQuestionIndex: 0, stage: "welcome", timerDefaultSec: 30, timerRemainingSec: 30,
    timerRunning: false, timerEndsAt: null, leaderboardVisible: false, answerRevealed: false,
    displayOpenedAt: null, winnerTeamId: null, lastHostAction: "Ready", updatedAt: configuration.updatedAt.toISOString(),
    ...object(configuration.liveState),
  };
  // Content participates in the revision so score and roster changes refresh the projector too.
  const scoreHistory = configuration.scoreActions.map(action => object(action.payload));
  const revision = createHash("sha256").update(JSON.stringify({ event, live, scoreHistory })).digest("hex");
  return { configuration, event, live, scoreHistory, revision };
}

export function triviaLiveResponse(snapshot: NonNullable<Awaited<ReturnType<typeof readTriviaLive>>>, now = new Date().toISOString()) {
  return { event: snapshot.event, live: resolveTriviaTimer(snapshot.live, now), scoreHistory: snapshot.scoreHistory, revision: snapshot.revision, serverNow: now };
}

export async function commandTriviaLive(organizationId: string, eventId: string, action: string, payload: JsonObject, expectedRevision?: string) {
  const snapshot = await readTriviaLive(organizationId, eventId);
  if (!snapshot) return { status: 404 as const, message: "Trivia event not found." };
  if (expectedRevision && snapshot.revision !== expectedRevision) return { status: 409 as const, message: "The game changed in another control. Review its current state and try again.", snapshot };
  const now = new Date().toISOString();
  const transition = applyRemoteTriviaHostAction(snapshot.event, snapshot.live, action, payload, now);
  if (!transition.ok) return { status: 400 as const, message: transition.message };
  if (JSON.stringify(transition.live) === JSON.stringify(snapshot.live)) return { status: 200 as const, snapshot };
  // Compare the storage timestamp as well as the public content revision. Two hosts
  // cannot acknowledge conflicting updates against the same stored configuration.
  const saved = await prisma.$transaction(async tx => {
    const updated = await tx.triviaConfiguration.updateMany({
      where: { id: snapshot.configuration.id, updatedAt: snapshot.configuration.updatedAt },
      data: { updatedAt: new Date(Math.max(Date.parse(now), snapshot.configuration.updatedAt.getTime() + 1)), liveState: transition.live as Prisma.InputJsonObject, ...(action === "set_status" ? { status: String(payload.status), payload: { ...object(snapshot.configuration.payload), updatedAt: now } as Prisma.InputJsonObject } : {}) },
    });
    if (updated.count !== 1) return false;
    await tx.triviaAuditEvent.create({ data: { id: `audit-${randomUUID()}`, createdAt: new Date(now), configurationId: snapshot.configuration.id, type: "manual", message: `Host control: ${action}`, metadata: { action } } });
    return true;
  });
  const current = await readTriviaLive(organizationId, snapshot.configuration.eventId);
  if (!current) return { status: 404 as const, message: "Trivia event not found." };
  return saved ? { status: 200 as const, snapshot: current } : { status: 409 as const, message: "The game changed in another control. Review its current state and try again.", snapshot: current };
}
