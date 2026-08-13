/** Daily one-way QuickBooks donation sink worker. */
import { prisma } from "../lib/prisma.js";
import { queueEligibleQuickBooksDonations, syncOneQuickBooksItem } from "../routes/quickbooks.js";
import type { Prisma } from "@prisma/client";

interface WorkerStatus {
  running: boolean;
  processing: boolean;
  pollMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastSynced: number;
  lastFailed: number;
}

const pollMs = Math.max(60_000, Number.parseInt(process.env.QB_SYNC_POLL_MS ?? "300000", 10) || 300_000);
const state: WorkerStatus = { running: false, processing: false, pollMs, lastRunAt: null, lastSuccessAt: null, lastError: null, lastSynced: 0, lastFailed: 0 };
let timer: NodeJS.Timeout | null = null;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function localDateAndHour(now: Date, timeZone: string): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { date: `${value.year}-${value.month}-${value.day}`, hour: Number(value.hour) };
  } catch {
    return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  }
}

export async function processQuickBooksDailySyncPass(now = new Date()): Promise<void> {
  if (state.processing) return;
  state.processing = true;
  state.lastRunAt = now.toISOString();
  state.lastError = null;
  state.lastSynced = 0;
  state.lastFailed = 0;
  try {
    const plugins = await prisma.pluginSetting.findMany({
      where: { pluginKey: "quickbooks", enabled: true },
      include: { organization: { select: { settings: { select: { timezone: true } } } } },
    });
    for (const plugin of plugins) {
      const config = asRecord(plugin.config);
      if (config.qbDailySyncEnabled === false || !config.access_token) continue;
      const local = localDateAndHour(now, plugin.organization.settings?.timezone ?? "America/Chicago");
      const dailyHour = Math.min(23, Math.max(0, Number(config.qbDailySyncHour ?? 23)));
      if (local.hour < dailyHour || config.qbLastDailySyncDate === local.date) continue;

      // Claim today's run before network writes. Stable request IDs and the DB
      // unique key provide a second idempotency layer if another process races.
      await prisma.pluginSetting.update({
        where: { id: plugin.id },
        data: { config: { ...config, qbLastDailySyncDate: local.date, qbLastDailySyncStartedAt: now.toISOString() } as Prisma.InputJsonValue },
      });
      await queueEligibleQuickBooksDonations(plugin.organizationId);
      const pending = await prisma.qBSyncQueueItem.findMany({
        where: { organizationId: plugin.organizationId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 5000,
        select: { id: true },
      });
      for (const item of pending) {
        const result = await syncOneQuickBooksItem(item.id, plugin.organizationId);
        if (result.success) state.lastSynced += 1;
        else state.lastFailed += 1;
      }
    }
    state.lastSuccessAt = new Date().toISOString();
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "QuickBooks daily sync failed";
    console.error("[quickbooks-sync-worker] Daily pass failed:", error);
  } finally {
    state.processing = false;
  }
}

export function startQuickBooksSyncWorker(): void {
  if (timer) return;
  state.running = true;
  timer = setInterval(() => void processQuickBooksDailySyncPass(), state.pollMs);
  timer.unref?.();
  void processQuickBooksDailySyncPass();
}

export function getQuickBooksSyncWorkerStatus(): WorkerStatus {
  return { ...state };
}
