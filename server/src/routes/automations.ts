/**
 * Automations API routes.
 * CRUD for workflow automation rules.
 * Each automation has a trigger type and an ordered list of actions.
 *
 * @module routes/automations
 */
import { Router } from "express";
import { Prisma, type AutomationActionType, type AutomationTrigger } from "@prisma/client";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { executeStewardPathsForTrigger } from "../services/stewardPathsEngine.js";

const router = Router();

// All automation routes require authentication.
router.use(requireAuth);

interface PresetAutomation {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  triggerConfig?: Record<string, unknown>;
  actions: Array<{
    type: AutomationActionType;
    order: number;
    config: Record<string, unknown>;
  }>;
}

const PRESET_AUTOMATIONS: PresetAutomation[] = [
  {
    id: "preset-thank-you",
    name: "Donation Thank-You Flow",
    description: "Send thank-you email and create a follow-up task after each completed donation.",
    trigger: "DONATION_RECEIVED",
    actions: [
      { type: "SEND_EMAIL", order: 0, config: { template: "thank-you" } },
      { type: "CREATE_TASK", order: 1, config: { title: "Call donor in 48 hours", priority: "HIGH" } },
      { type: "ADD_TAG", order: 2, config: { tag: "Thanked" } },
    ],
  },
  {
    id: "preset-first-time-donor",
    name: "First-Time Donor Welcome",
    description: "When a donation arrives, run welcome outreach and stewardship follow-up for new donor onboarding.",
    trigger: "DONATION_RECEIVED",
    triggerConfig: {
      firstDonationOnly: true,
    },
    actions: [
      { type: "SEND_EMAIL", order: 0, config: { template: "first-time-donor-welcome" } },
      { type: "ADD_TAG", order: 1, config: { tag: "First-Time Donor" } },
      { type: "CREATE_TASK", order: 2, config: { title: "Call new donor within 48 hours", priority: "HIGH" } },
    ],
  },
  {
    id: "preset-major-gift",
    name: "Major Gift Follow-Up",
    description: "When a donation arrives, assign a high-priority major donor follow-up and mark as major gift.",
    trigger: "DONATION_RECEIVED",
    triggerConfig: {
      majorGiftMinAmount: 1000,
    },
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Schedule major donor thank-you meeting", priority: "URGENT" } },
      { type: "ADD_TAG", order: 1, config: { tag: "Major Gift" } },
      { type: "UPDATE_FIELD", order: 2, config: { field: "donorStatus", value: "MAJOR_DONOR" } },
    ],
  },
  {
    id: "preset-new-constituent",
    name: "New Constituent Welcome",
    description: "Welcome email + internal assignment when a new constituent is created.",
    trigger: "CONSTITUENT_CREATED",
    actions: [
      { type: "SEND_EMAIL", order: 0, config: { template: "welcome" } },
      { type: "ASSIGN_USER", order: 1, config: { role: "staff" } },
      { type: "CREATE_TASK", order: 2, config: { title: "Review profile completeness" } },
    ],
  },
  {
    id: "preset-pledge-reminder",
    name: "Pledge Payment Reminder",
    description: "When a pledge payment date is approaching, create a reminder task and optionally notify the donor.",
    trigger: "PLEDGE_CREATED",
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Follow up on upcoming pledge payment", priority: "HIGH", daysAfter: 21 } },
      { type: "SEND_EMAIL", order: 1, config: { template: "pledge-reminder" } },
    ],
  },
];

const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  "DONATION_RECEIVED",
  "CONSTITUENT_CREATED",
  "TASK_DUE",
  "PLEDGE_CREATED",
  "EMAIL_OPENED",
  "EVENT_REGISTERED",
];

const AUTOMATION_ACTION_TYPES: AutomationActionType[] = [
  "SEND_EMAIL",
  "CREATE_TASK",
  "UPDATE_FIELD",
  "ADD_TAG",
  "REMOVE_TAG",
  "ASSIGN_USER",
];

interface SharingSettings {
  ownerId: string | null;
  sharedWithOrganization: boolean;
}

/** Safely parse sharing settings from triggerConfig JSON. */
function parseAutomationSharing(triggerConfig: unknown): SharingSettings {
  if (!triggerConfig || typeof triggerConfig !== "object" || Array.isArray(triggerConfig)) {
    return { ownerId: null, sharedWithOrganization: true };
  }
  const cfg = triggerConfig as Record<string, unknown>;
  const sharing = cfg._sharing;
  if (!sharing || typeof sharing !== "object" || Array.isArray(sharing)) {
    return { ownerId: null, sharedWithOrganization: true };
  }
  const sharingObj = sharing as Record<string, unknown>;
  return {
    ownerId: typeof sharingObj.ownerId === "string" ? sharingObj.ownerId : null,
    sharedWithOrganization:
      typeof sharingObj.sharedWithOrganization === "boolean"
        ? sharingObj.sharedWithOrganization
        : true,
  };
}

/** Writes sharing metadata into triggerConfig while preserving existing keys. */
function withAutomationSharing(triggerConfig: unknown, ownerId: string, sharedWithOrganization: boolean): Prisma.InputJsonValue {
  const base = triggerConfig && typeof triggerConfig === "object" && !Array.isArray(triggerConfig)
    ? { ...(triggerConfig as Record<string, unknown>) }
    : {};
  return {
    ...base,
    _sharing: {
      ownerId,
      sharedWithOrganization,
    },
  } as Prisma.InputJsonValue;
}

/** True if the current user can see a Steward Path. */
function canAccessAutomation(sharing: SharingSettings, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  if (!sharing.ownerId) return true;
  if (sharing.ownerId === userId) return true;
  return sharing.sharedWithOrganization;
}

/** True if the current user can edit/delete a Steward Path. */
function canManageAutomation(sharing: SharingSettings, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  if (!sharing.ownerId) return true;
  return sharing.ownerId === userId;
}

/** Safely parses valid automation trigger enum values. */
function parseAutomationTrigger(value: unknown): AutomationTrigger | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toUpperCase() as AutomationTrigger;
  return AUTOMATION_TRIGGERS.includes(candidate) ? candidate : null;
}

/** Safely parses valid automation action-type enum values. */
function parseAutomationActionType(value: unknown): AutomationActionType | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toUpperCase() as AutomationActionType;
  return AUTOMATION_ACTION_TYPES.includes(candidate) ? candidate : null;
}

/**
 * GET /api/automations
 * Returns all automations for the org, including their actions ordered by `order`.
 */
router.get("/", async (_req, res) => {
  const userId = _req.user?.sub;
  const role = _req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req: _req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const automations = await prisma.automation.findMany({
    where: { organizationId },
    include: { actions: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const visible = automations
    .filter((automation) => canAccessAutomation(parseAutomationSharing(automation.triggerConfig), userId, role))
    .map((automation) => {
      const sharing = parseAutomationSharing(automation.triggerConfig);
      return {
        ...automation,
        ownerId: sharing.ownerId,
        sharedWithOrganization: sharing.sharedWithOrganization,
      };
    });

  res.json(visible);
});

/** GET /api/automations/presets — Return predefined automation templates users can install. */
router.get("/presets", (_req, res) => {
  res.json(PRESET_AUTOMATIONS);
});

interface RunHistoryItem {
  id: string;
  runId: string;
  automationId: string;
  automationName: string;
  trigger: string;
  source: string;
  status: "SUCCESS" | "FAILED";
  actionsAttempted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  constituentId: string | null;
  donationId: string | null;
  taskId: string | null;
  createdAt: string;
  results: Array<{
    actionId: string;
    type: string;
    success: boolean;
    message: string;
  }>;
}

/** Best-effort conversion from Prisma Json value to object. */
function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Best-effort conversion from unknown to string (fallback when missing). */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Best-effort conversion from unknown to number (fallback when missing). */
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Converts unknown query input to ISO date when valid, otherwise null. */
function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Normalizes run status from attempted/succeeded counters. */
function runStatus(item: { actionsAttempted: number; actionsSucceeded: number }): "SUCCESS" | "FAILED" {
  if (item.actionsAttempted <= 0) return "SUCCESS";
  return item.actionsSucceeded < item.actionsAttempted ? "FAILED" : "SUCCESS";
}

/** Converts audit logs into normalized run history items. */
function mapRunLogsToHistory(logs: Array<{ id: string; entityId: string | null; createdAt: Date; metadata: unknown }>, nameMap: Map<string, string>): RunHistoryItem[] {
  return logs.map((log) => {
    const md = jsonObject(log.metadata);
    const rawResults = Array.isArray(md.results) ? md.results : [];
    const results = rawResults
      .map((entry) => jsonObject(entry))
      .map((entry) => ({
        actionId: asString(entry.actionId),
        type: asString(entry.type),
        success: entry.success === true,
        message: asString(entry.message),
      }));

    const automationId = asString(md.automationId, log.entityId ?? "");
    const actionsAttempted = asNumber(md.actionsAttempted, results.length);
    const actionsSucceeded = asNumber(md.actionsSucceeded, results.filter((r) => r.success).length);

    return {
      id: log.id,
      runId: asString(md.runId, log.id),
      automationId,
      automationName: asString(md.automationName, nameMap.get(automationId) ?? "Steward Path"),
      trigger: asString(md.trigger, "UNKNOWN"),
      source: asString(md.source, "unknown"),
      status: runStatus({ actionsAttempted, actionsSucceeded }),
      actionsAttempted,
      actionsSucceeded,
      actionsFailed: Math.max(actionsAttempted - actionsSucceeded, 0),
      constituentId: asString(md.constituentId, "") || null,
      donationId: asString(md.donationId, "") || null,
      taskId: asString(md.taskId, "") || null,
      createdAt: log.createdAt.toISOString(),
      results,
    };
  });
}

/**
 * GET /api/automations/runs?limit=50
 * Returns most recent Steward Path execution runs with per-action traces.
 */
router.get("/runs", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
  const sourceFilter = typeof req.query.source === "string" ? req.query.source.trim().toLowerCase() : "";
  const triggerFilter = typeof req.query.trigger === "string" ? req.query.trigger.trim().toUpperCase() : "";
  const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
  const from = asDate(req.query.from);
  const to = asDate(req.query.to);

  const automationsForAccess = await prisma.automation.findMany({
    where: { organizationId },
    select: { id: true, name: true, triggerConfig: true },
  });
  const visibleAutomations = automationsForAccess.filter((automation) =>
    canAccessAutomation(parseAutomationSharing(automation.triggerConfig), userId, role)
  );
  const visibleIds = visibleAutomations.map((automation) => automation.id);
  if (visibleIds.length === 0) {
    res.json([]);
    return;
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_PATH_RUN",
      entityId: { in: visibleIds },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 4, 200),
    select: {
      id: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const nameMap = new Map(visibleAutomations.map((a) => [a.id, a.name]));
  const filtered = mapRunLogsToHistory(logs, nameMap)
    .filter((run) => (sourceFilter ? run.source.toLowerCase() === sourceFilter : true))
    .filter((run) => (triggerFilter ? run.trigger.toUpperCase() === triggerFilter : true))
    .filter((run) => (statusFilter === "FAILED" || statusFilter === "SUCCESS" ? run.status === statusFilter : true))
    .filter((run) => (from ? new Date(run.createdAt) >= from : true))
    .filter((run) => (to ? new Date(run.createdAt) <= to : true))
    .slice(0, limit);

  res.json(filtered);
});

/**
 * GET /api/automations/runs/diagnostics
 * Returns operations diagnostics for Steward Path runs (failure rate, trigger/source breakdown, recent failures).
 */
router.get("/runs/diagnostics", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalRuns: 0,
      failedRuns: 0,
      failureRate: 0,
      runsLast24h: 0,
      byTrigger: [],
      bySource: [],
      lastFailedRuns: [],
    });
    return;
  }

  const automationsForAccess = await prisma.automation.findMany({
    where: { organizationId },
    select: { id: true, name: true, triggerConfig: true },
  });
  const visibleAutomations = automationsForAccess.filter((automation) =>
    canAccessAutomation(parseAutomationSharing(automation.triggerConfig), userId, role)
  );
  const visibleIds = visibleAutomations.map((automation) => automation.id);
  if (visibleIds.length === 0) {
    res.json({
      totalRuns: 0,
      failedRuns: 0,
      failureRate: 0,
      runsLast24h: 0,
      byTrigger: [],
      bySource: [],
      lastFailedRuns: [],
    });
    return;
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_PATH_RUN",
      entityId: { in: visibleIds },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const nameMap = new Map(visibleAutomations.map((a) => [a.id, a.name]));
  const runs = mapRunLogsToHistory(logs, nameMap);
  const failedRuns = runs.filter((run) => run.status === "FAILED");
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const byTriggerMap = new Map<string, number>();
  const bySourceMap = new Map<string, number>();
  for (const run of runs) {
    byTriggerMap.set(run.trigger, (byTriggerMap.get(run.trigger) ?? 0) + 1);
    bySourceMap.set(run.source, (bySourceMap.get(run.source) ?? 0) + 1);
  }

  res.json({
    totalRuns: runs.length,
    failedRuns: failedRuns.length,
    failureRate: runs.length > 0 ? Number(((failedRuns.length / runs.length) * 100).toFixed(1)) : 0,
    runsLast24h: runs.filter((run) => new Date(run.createdAt).getTime() >= dayAgo).length,
    byTrigger: Array.from(byTriggerMap.entries()).map(([trigger, count]) => ({ trigger, count })),
    bySource: Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count })),
    lastFailedRuns: failedRuns.slice(0, 5),
  });
});

/**
 * POST /api/automations/runs/:runId/retry
 * Replays one historical Steward Path run with its original trigger context.
 */
router.post("/runs/:runId/retry", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const runLog = await prisma.auditLog.findFirst({
    where: {
      id: req.params.runId,
      organizationId,
      action: "STEWARD_PATH_RUN",
    },
    select: {
      id: true,
      entityId: true,
      metadata: true,
    },
  });
  if (!runLog) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Run not found" } });
    return;
  }

  const metadata = jsonObject(runLog.metadata);
  const automationId = asString(metadata.automationId, runLog.entityId ?? "");
  const trigger = parseAutomationTrigger(metadata.trigger);
  if (!trigger) {
    res.status(400).json({ error: { code: "INVALID_TRIGGER", message: "Run trigger metadata is missing or invalid" } });
    return;
  }

  const automation = await prisma.automation.findFirst({
    where: {
      id: automationId,
      organizationId,
    },
    select: { id: true, triggerConfig: true },
  });
  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found for this run" } });
    return;
  }
  if (!canAccessAutomation(parseAutomationSharing(automation.triggerConfig), userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to retry this run" } });
    return;
  }

  const retryResult = await executeStewardPathsForTrigger({
    organizationId,
    trigger,
    constituentId: asString(metadata.constituentId, "") || undefined,
    donationId: asString(metadata.donationId, "") || undefined,
    taskId: asString(metadata.taskId, "") || undefined,
    userId,
    source: "manual_retry",
  });

  res.status(201).json({
    retriedRunId: req.params.runId,
    trigger,
    retryResult,
  });
});

/**
 * POST /api/automations/from-preset
 * Installs a predefined preset as a real automation record.
 */
router.post("/from-preset", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const { presetId, name, enabled = true, sharedWithOrganization = false } = req.body as {
    presetId?: string;
    name?: string;
    enabled?: boolean;
    sharedWithOrganization?: boolean;
  };
  const preset = PRESET_AUTOMATIONS.find((p) => p.id === presetId);
  if (!preset) {
    res.status(404).json({ error: { code: "PRESET_NOT_FOUND", message: "Preset not found" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const automation = await prisma.automation.create({
    data: {
      organizationId,
      name: name || preset.name,
      description: preset.description,
      trigger: preset.trigger as never,
      triggerConfig: withAutomationSharing(
        preset.triggerConfig ?? undefined,
        userId,
        Boolean(sharedWithOrganization)
      ),
      enabled,
      actions: {
        create: preset.actions.map((a) => ({
          type: a.type as never,
          order: a.order,
          config: a.config as object,
        })),
      },
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  res.status(201).json(automation);
});

/**
 * GET /api/automations/:id/runs?limit=50
 * Returns recent runs for one Steward Path with per-action traces.
 */
router.get("/:id/runs", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

  const automation = await prisma.automation.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    select: { id: true, name: true, triggerConfig: true },
  });

  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  const sharing = parseAutomationSharing((automation as { triggerConfig?: unknown }).triggerConfig);
  if (!canAccessAutomation(sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this Steward Path" } });
    return;
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_PATH_RUN",
      entityId: automation.id,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const nameMap = new Map([[automation.id, automation.name]]);
  res.json(mapRunLogsToHistory(logs, nameMap));
});

/**
 * GET /api/automations/:id
 * Returns a single automation with its actions.
 */
router.get("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const automation = await prisma.automation.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  const sharing = parseAutomationSharing(automation.triggerConfig);
  if (!canAccessAutomation(sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this Steward Path" } });
    return;
  }

  res.json({
    ...automation,
    ownerId: sharing.ownerId,
    sharedWithOrganization: sharing.sharedWithOrganization,
  });
});

/**
 * POST /api/automations
 * Creates a new automation with optional nested actions.
 *
 * Request body:
 * - name: string
 * - trigger: AutomationTrigger
 * - description?: string
 * - triggerConfig?: Record<string, unknown>
 * - enabled?: boolean
 * - actions?: Array<{ type, config?, order? }>
 */
router.post("/", async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const {
    name,
    trigger,
    description,
    triggerConfig,
    enabled = true,
    actions = [],
    sharedWithOrganization = false,
  } = req.body;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const automation = await prisma.automation.create({
    data: {
      organizationId,
      name,
      trigger,
      description,
      triggerConfig: withAutomationSharing(triggerConfig ?? undefined, userId, Boolean(sharedWithOrganization)),
      enabled,
      actions: {
        // Create all actions in the same transaction
        create: actions.map((a: { type: string; config?: unknown; order?: number }, i: number) => ({
          type: a.type,
          config: a.config ?? undefined,
          order: a.order ?? i,
        })),
      },
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  res.status(201).json(automation);
});

/**
 * PATCH /api/automations/:id
 * Updates automation fields. To toggle enabled, send `{ enabled: boolean }`.
 * Does NOT update nested actions via this endpoint — use the action sub-routes.
 */
router.patch("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const { actions: _actions, sharedWithOrganization, ...data } = req.body;

  const existing = await prisma.automation.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true, triggerConfig: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  const sharing = parseAutomationSharing(existing.triggerConfig);
  if (!canManageAutomation(sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can edit this Steward Path" } });
    return;
  }

  const ownerId = sharing.ownerId ?? userId;
  const nextShared = typeof sharedWithOrganization === "boolean"
    ? sharedWithOrganization
    : sharing.sharedWithOrganization;
  const nextTriggerConfig = withAutomationSharing(
    data.triggerConfig !== undefined ? data.triggerConfig : existing.triggerConfig,
    ownerId,
    nextShared,
  );

  const automation = await prisma.automation.update({
    where: { id: req.params.id },
    data: {
      ...data,
      triggerConfig: nextTriggerConfig,
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  res.json({
    ...automation,
    ownerId,
    sharedWithOrganization: nextShared,
  });
});

/**
 * PUT /api/automations/:id/workflow
 * Replaces one automation workflow definition including ordered actions.
 */
router.put("/:id/workflow", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const existing = await prisma.automation.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true, triggerConfig: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  const sharing = parseAutomationSharing(existing.triggerConfig);
  if (!canManageAutomation(sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can edit this Steward Path" } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: { code: "INVALID_NAME", message: "name is required" } });
    return;
  }

  const trigger = parseAutomationTrigger(req.body?.trigger);
  if (!trigger) {
    res.status(400).json({ error: { code: "INVALID_TRIGGER", message: "trigger is invalid" } });
    return;
  }

  const rawActions = Array.isArray(req.body?.actions) ? req.body.actions : [];
  if (rawActions.length === 0) {
    res.status(400).json({ error: { code: "ACTIONS_REQUIRED", message: "At least one action is required" } });
    return;
  }

  const normalizedActions = rawActions.map((item: unknown, index: number) => {
    const action = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const type = parseAutomationActionType(action.type);
    if (!type) {
      throw new Error(`invalid_action_type:${index}`);
    }
    return {
      type,
      order: index,
      config: action.config && typeof action.config === "object" && !Array.isArray(action.config)
        ? (action.config as Record<string, unknown>)
        : undefined,
    };
  });

  const ownerId = sharing.ownerId ?? userId;
  const nextTriggerConfig = withAutomationSharing(
    req.body?.triggerConfig ?? undefined,
    ownerId,
    sharing.sharedWithOrganization,
  );

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.automationAction.deleteMany({ where: { automationId: existing.id } });
      await tx.automation.update({
        where: { id: existing.id },
        data: {
          name,
          description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
          trigger,
          triggerConfig: nextTriggerConfig,
          actions: {
            create: normalizedActions,
          },
        },
      });

      return tx.automation.findUnique({
        where: { id: existing.id },
        include: { actions: { orderBy: { order: "asc" } } },
      });
    });

    res.json({
      ...updated,
      ownerId,
      sharedWithOrganization: sharing.sharedWithOrganization,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("invalid_action_type:")) {
      const index = error.message.split(":")[1] ?? "unknown";
      res.status(400).json({ error: { code: "INVALID_ACTION", message: `Action at index ${index} has an invalid type` } });
      return;
    }
    throw error;
  }
});

/**
 * DELETE /api/automations/:id
 * Deletes an automation and all its actions (cascade).
 */
router.delete("/:id", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const existing = await prisma.automation.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true, triggerConfig: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  if (!canManageAutomation(parseAutomationSharing(existing.triggerConfig), userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can delete this Steward Path" } });
    return;
  }

  await prisma.automation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

/**
 * POST /api/automations/:id/run
 * Executes a manual test run of the automation trigger using provided context.
 * This runs through the Steward Paths execution service and returns action results.
 */
router.post("/:id/run", async (req, res) => {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const automation = await prisma.automation.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }

  const sharing = parseAutomationSharing(automation.triggerConfig);
  if (!canAccessAutomation(sharing, userId, role)) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this Steward Path" } });
    return;
  }

  const inputConstituentId = typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined;
  const inputDonationId = typeof req.body?.donationId === "string" ? req.body.donationId : undefined;
  const inputTaskId = typeof req.body?.taskId === "string" ? req.body.taskId : undefined;

  const run = await executeStewardPathsForTrigger({
    organizationId: automation.organizationId,
    trigger: automation.trigger,
    constituentId: inputConstituentId,
    donationId: inputDonationId,
    taskId: inputTaskId,
    userId,
    source: "manual-run",
  });

  const refreshed = await prisma.automation.findUnique({
    where: { id: req.params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  res.json({ success: true, automation: refreshed, run });
});

export default router;
