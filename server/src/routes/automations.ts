/**
 * Automations API routes.
 * CRUD for workflow automation rules.
 * Each automation has a trigger type and an ordered list of actions.
 *
 * @module routes/automations
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/** Default org ID — will be replaced by session-based org lookup in a future auth refactor. */
const ORG_ID = "org_demo";

const PRESET_AUTOMATIONS = [
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
    id: "preset-lapsed-reengagement",
    name: "Lapsed Donor Re-engagement",
    description: "When a task is due for a lapsed donor, create outreach sequence actions.",
    trigger: "TASK_DUE",
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Send re-engagement email" } },
      { type: "CREATE_TASK", order: 1, config: { title: "Call donor if no response in 7 days" } },
      { type: "SEND_EMAIL", order: 2, config: { template: "impact-story" } },
    ],
  },
] as const;

/**
 * GET /api/automations
 * Returns all automations for the org, including their actions ordered by `order`.
 */
router.get("/", async (_req, res) => {
  const automations = await prisma.automation.findMany({
    where: { organizationId: ORG_ID },
    include: { actions: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(automations);
});

/** GET /api/automations/presets — Return predefined automation templates users can install. */
router.get("/presets", (_req, res) => {
  res.json(PRESET_AUTOMATIONS);
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

  const automation = await prisma.automation.create({
    data: {
      organizationId: ORG_ID,
      name: name || preset.name,
      description: preset.description,
      trigger: preset.trigger as never,
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

  const automation = await prisma.automation.create({
    data: {
      organizationId: ORG_ID,
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
 * Simulates a manual test run of the automation.
 * Increments runCount and sets lastRunAt. Real execution engine is a future feature.
 */
router.post("/:id/run", async (req, res) => {
  const automation = await prisma.automation.update({
    where: { id: req.params.id },
    data: {
      runCount: { increment: 1 },
      lastRunAt: new Date(),
    },
    include: { actions: { orderBy: { order: "asc" } } },
  });
  res.json({ success: true, automation });
});

export default router;
