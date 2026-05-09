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

/**
 * GET /api/automations
 * Returns all automations for the org, including their actions ordered by `order`.
 */
router.get("/", async (_req, res) => {
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
  res.json(automations);
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
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_PATH_RUN",
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

  const automationIds = logs.map((log) => log.entityId).filter((id): id is string => Boolean(id));
  const automations = await prisma.automation.findMany({
    where: {
      organizationId,
      id: { in: automationIds },
    },
    select: { id: true, name: true },
  });

  const nameMap = new Map(automations.map((a) => [a.id, a.name]));
  res.json(mapRunLogsToHistory(logs, nameMap));
});

/**
 * POST /api/automations/from-preset
 * Installs a predefined preset as a real automation record.
 */
router.post("/from-preset", async (req, res) => {
  const { presetId, name, enabled = true } = req.body as { presetId?: string; name?: string; enabled?: boolean };
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
      triggerConfig: (preset.triggerConfig ?? undefined) as Prisma.InputJsonValue | undefined,
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
    select: { id: true, name: true },
  });

  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
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
  const automation = await prisma.automation.findUnique({
    where: { id: req.params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
    return;
  }
  res.json(automation);
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
  const { name, trigger, description, triggerConfig, enabled = true, actions = [] } = req.body;
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
      // Prisma requires explicit InputJsonValue cast for Json fields
      triggerConfig: triggerConfig ?? undefined,
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
  const { actions: _actions, ...data } = req.body;

  const automation = await prisma.automation.update({
    where: { id: req.params.id },
    data,
    include: { actions: { orderBy: { order: "asc" } } },
  });
  res.json(automation);
});

/**
 * DELETE /api/automations/:id
 * Deletes an automation and all its actions (cascade).
 */
router.delete("/:id", async (req, res) => {
  await prisma.automation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

/**
 * POST /api/automations/:id/run
 * Executes a manual test run of the automation trigger using provided context.
 * This runs through the Steward Paths execution service and returns action results.
 */
router.post("/:id/run", async (req, res) => {
  const automation = await prisma.automation.findUnique({
    where: { id: req.params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  if (!automation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Automation not found" } });
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
    userId: req.user?.sub,
    source: "manual-run",
  });

  const refreshed = await prisma.automation.findUnique({
    where: { id: req.params.id },
    include: { actions: { orderBy: { order: "asc" } } },
  });

  res.json({ success: true, automation: refreshed, run });
});

export default router;
