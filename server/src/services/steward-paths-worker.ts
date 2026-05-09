/**
 * In-process Steward Paths worker.
 * Polls scheduled triggers like TASK_DUE and pledge timeline milestones.
 */
import { prisma } from "../lib/prisma.js";
import { executeStewardPathsForTrigger } from "./stewardPathsEngine.js";

export type StewardPathsWorkerHealth = "Working" | "Partial" | "Not Started";

export interface StewardPathsWorkerStatus {
  running: boolean;
  processing: boolean;
  status: StewardPathsWorkerHealth;
  pollMs: number;
  dueTaskCandidates: number;
  duePledgeCandidates: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface WorkerState {
  running: boolean;
  processing: boolean;
  pollMs: number;
  dueTaskCandidates: number;
  duePledgeCandidates: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

/** Parses a positive integer env var with fallback. */
function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const state: WorkerState = {
  running: false,
  processing: false,
  pollMs: parsePositiveIntEnv(process.env.STEWARD_PATHS_POLL_MS, 30000),
  dueTaskCandidates: 0,
  duePledgeCandidates: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
};

let timer: NodeJS.Timeout | null = null;

/** True when task due trigger has already been fired for this task. */
async function taskDueAlreadyFired(taskId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "STEWARD_PATH_TASK_DUE_FIRED",
      entity: "Task",
      entityId: taskId,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

/** True when pledge timeline trigger has already been fired for this pledge. */
async function pledgeTimelineAlreadyFired(pledgeId: string): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "STEWARD_PATH_PLEDGE_TIMELINE_FIRED",
      entity: "Pledge",
      entityId: pledgeId,
    },
    select: { id: true },
  });
  return Boolean(existing);
}

/** Finds due tasks and executes TASK_DUE trigger once per task. */
async function processDueTasks(now: Date): Promise<void> {
  const dueTasks = await prisma.task.findMany({
    where: {
      dueDate: { not: null, lte: now },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      constituentId: { not: null },
    },
    include: {
      constituent: { select: { id: true, organizationId: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 100,
  });

  state.dueTaskCandidates = dueTasks.length;

  for (const task of dueTasks) {
    if (!task.constituent?.organizationId) continue;
    if (await taskDueAlreadyFired(task.id)) continue;

    await executeStewardPathsForTrigger({
      organizationId: task.constituent.organizationId,
      trigger: "TASK_DUE",
      constituentId: task.constituentId ?? undefined,
      taskId: task.id,
      source: "steward-paths-worker:task-due",
    });

    await prisma.auditLog.create({
      data: {
        action: "STEWARD_PATH_TASK_DUE_FIRED",
        entity: "Task",
        entityId: task.id,
        organizationId: task.constituent.organizationId,
        metadata: {
          trigger: "TASK_DUE",
          constituentId: task.constituentId,
          dueDate: task.dueDate?.toISOString(),
        },
      },
    });
  }
}

/**
 * Finds pledge milestones and executes PLEDGE_CREATED as a timeline event trigger.
 * This fires once per pledge when the start date is reached.
 */
async function processPledgeTimeline(now: Date): Promise<void> {
  const pledges = await prisma.pledge.findMany({
    where: {
      active: true,
      startDate: { lte: now },
      constituentId: { not: "" },
    },
    include: {
      constituent: { select: { id: true, organizationId: true } },
    },
    orderBy: { startDate: "asc" },
    take: 100,
  });

  state.duePledgeCandidates = pledges.length;

  for (const pledge of pledges) {
    if (!pledge.constituent?.organizationId) continue;
    if (await pledgeTimelineAlreadyFired(pledge.id)) continue;

    await executeStewardPathsForTrigger({
      organizationId: pledge.constituent.organizationId,
      trigger: "PLEDGE_CREATED",
      constituentId: pledge.constituentId,
      source: "steward-paths-worker:pledge-timeline",
    });

    await prisma.auditLog.create({
      data: {
        action: "STEWARD_PATH_PLEDGE_TIMELINE_FIRED",
        entity: "Pledge",
        entityId: pledge.id,
        organizationId: pledge.constituent.organizationId,
        metadata: {
          trigger: "PLEDGE_CREATED",
          constituentId: pledge.constituentId,
          startDate: pledge.startDate.toISOString(),
          totalAmount: Number(pledge.totalAmount),
        },
      },
    });
  }
}

/** Runs one poll pass for scheduled Steward Paths triggers. */
async function processPass(): Promise<void> {
  if (state.processing) return;
  state.processing = true;
  state.lastRunAt = new Date().toISOString();
  state.lastError = null;

  try {
    const now = new Date();
    await processDueTasks(now);
    await processPledgeTimeline(now);
    state.lastSuccessAt = new Date().toISOString();
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Steward Paths worker failed";
    console.error("[steward-paths-worker] Poll failed:", error);
  } finally {
    state.processing = false;
  }
}

/** Starts the in-process Steward Paths poller. Safe to call multiple times. */
export function startStewardPathsWorker(): void {
  if (timer) return;
  state.running = true;
  timer = setInterval(() => {
    void processPass();
  }, state.pollMs);
  timer.unref?.();
  void processPass();
}

/** Stops the in-process Steward Paths poller. */
export function stopStewardPathsWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  state.running = false;
  state.processing = false;
}

/** Returns current worker status for diagnostics and health endpoints. */
export function getStewardPathsWorkerStatus(): StewardPathsWorkerStatus {
  const status: StewardPathsWorkerHealth = !state.running
    ? "Not Started"
    : state.lastError
      ? "Partial"
      : "Working";

  return {
    running: state.running,
    processing: state.processing,
    status,
    pollMs: state.pollMs,
    dueTaskCandidates: state.dueTaskCandidates,
    duePledgeCandidates: state.duePledgeCandidates,
    lastRunAt: state.lastRunAt,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError,
  };
}
