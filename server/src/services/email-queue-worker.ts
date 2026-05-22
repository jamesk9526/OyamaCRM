/**
 * In-process email campaign queue worker for scheduled campaign dispatch.
 * Polls for due scheduled campaigns and sends them using the shared email-campaign send helper.
 */
import { prisma } from "../lib/prisma.js";
import { sendCampaignNow } from "../routes/email-campaigns.js";

export type QueueHealthStatus = "Working" | "Broken" | "Not Implemented";

export interface EmailQueueWorkerStatus {
  running: boolean;
  processing: boolean;
  status: QueueHealthStatus;
  pollMs: number;
  batchSize: number;
  pendingDueCount: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface WorkerState {
  running: boolean;
  processing: boolean;
  pollMs: number;
  batchSize: number;
  pendingDueCount: number;
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

const workerState: WorkerState = {
  running: false,
  processing: false,
  pollMs: parsePositiveIntEnv(process.env.EMAIL_QUEUE_POLL_MS, 15000),
  batchSize: parsePositiveIntEnv(process.env.EMAIL_QUEUE_BATCH_SIZE, 10),
  pendingDueCount: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
};

let timer: NodeJS.Timeout | null = null;

/** Returns true for demo/stub campaign ids that should never hit real SMTP lanes. */
function isDemoCampaignId(id: string): boolean {
  return id.trim().toLowerCase().startsWith("demo_mail_");
}

/** Counts queued scheduled campaigns that are currently due for delivery. */
async function countDueCampaigns(now: Date): Promise<number> {
  return prisma.emailCampaign.count({
    where: {
      status: "SCHEDULED",
      scheduledAt: {
        not: null,
        lte: now,
      },
    },
  });
}

/** Runs one queue pass, sending due campaigns in order by scheduled time. */
async function processQueuePass(): Promise<void> {
  if (workerState.processing) return;
  workerState.processing = true;
  workerState.lastRunAt = new Date().toISOString();
  workerState.lastError = null;

  try {
    const now = new Date();
    const dueCampaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          not: null,
          lte: now,
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: workerState.batchSize,
      select: { id: true },
    });

    for (const campaign of dueCampaigns) {
      if (isDemoCampaignId(campaign.id)) {
        await prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: "DRAFT",
            scheduledAt: null,
          },
        });
        console.warn(`[email-queue-worker] Campaign ${campaign.id} unscheduled — demo campaign ids are excluded from queue sends.`);
        continue;
      }

      try {
        await sendCampaignNow(campaign.id, "QUEUE");
      } catch (err) {
        // Keep the worker alive and surface per-campaign failures in status.
        workerState.lastError = err instanceof Error ? err.message : "Unknown queue send error";

        // For SMTP authentication / config errors, print a concise one-line warning
        // instead of a full stack trace so dev logs stay readable before creds are set up.
        const isSmtpConfigError =
          err instanceof Error &&
          (err.message.includes("Authentication required") ||
            err.message.includes("Outbound email provider is not ready") ||
            err.message.includes("SMTP host is required") ||
            (err as NodeJS.ErrnoException).code === "EAUTH" ||
            (err as NodeJS.ErrnoException).code === "EENVELOPE" ||
            (err as NodeJS.ErrnoException).code === "ECONNECTION");

        if (isSmtpConfigError) {
          console.warn(
            `[email-queue-worker] Campaign ${campaign.id} skipped — email not configured yet (${err instanceof Error ? err.message : "unknown"})`,
          );
        } else {
          console.error("[email-queue-worker] Failed to process campaign:", campaign.id, err);
        }
      }
    }

    workerState.pendingDueCount = await countDueCampaigns(new Date());
    if (dueCampaigns.length > 0 && !workerState.lastError) {
      workerState.lastSuccessAt = new Date().toISOString();
    }
  } catch (err) {
    workerState.lastError = err instanceof Error ? err.message : "Queue worker failed";
    console.error("[email-queue-worker] Queue pass failed:", err);
  } finally {
    workerState.processing = false;
  }
}

/** Starts the in-process queue poller. Safe to call multiple times. */
export function startEmailQueueWorker(): void {
  if (timer) return;
  workerState.running = true;
  timer = setInterval(() => {
    void processQueuePass();
  }, workerState.pollMs);
  timer.unref?.();
  void processQueuePass();
}

/** Stops the in-process queue poller. */
export function stopEmailQueueWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  workerState.running = false;
  workerState.processing = false;
}

/** Returns the current queue worker health snapshot for diagnostics surfaces. */
export function getEmailQueueWorkerStatus(): EmailQueueWorkerStatus {
  const status: QueueHealthStatus = !workerState.running
    ? "Not Implemented"
    : workerState.lastError
      ? "Broken"
      : "Working";

  return {
    running: workerState.running,
    processing: workerState.processing,
    status,
    pollMs: workerState.pollMs,
    batchSize: workerState.batchSize,
    pendingDueCount: workerState.pendingDueCount,
    lastRunAt: workerState.lastRunAt,
    lastSuccessAt: workerState.lastSuccessAt,
    lastError: workerState.lastError,
  };
}

