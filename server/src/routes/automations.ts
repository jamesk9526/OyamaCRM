/**
 * Automations API routes.
 * CRUD for workflow automation rules.
 * Each automation has a trigger type and an ordered list of actions.
 *
 * @module routes/automations
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// All automation routes require authentication.
router.use(requireAuth);

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
    id: "preset-first-time-donor",
    name: "First-Time Donor Welcome",
    description: "When someone gives their first donation, send a welcome email, add a tag, and create a stewardship call task.",
    trigger: "FIRST_DONATION_RECEIVED",
    actions: [
      { type: "SEND_EMAIL", order: 0, config: { template: "first-time-donor-welcome" } },
      { type: "ADD_TAG", order: 1, config: { tag: "First-Time Donor" } },
      { type: "CREATE_TASK", order: 2, config: { title: "Call new donor within 48 hours", priority: "HIGH", category: "Thank-You Call" } },
      { type: "ADD_TIMELINE", order: 3, config: { note: "First gift received — welcome flow started" } },
    ],
  },
  {
    id: "preset-major-gift",
    name: "Major Gift Follow-Up",
    description: "When a gift above your major donor threshold is received, notify staff and schedule a thank-you visit.",
    trigger: "MAJOR_DONATION_RECEIVED",
    actions: [
      { type: "NOTIFY_STAFF", order: 0, config: { message: "Major gift received — please review immediately" } },
      { type: "CREATE_TASK", order: 1, config: { title: "Schedule major donor thank-you meeting", priority: "URGENT", category: "Major Donor Cultivation" } },
      { type: "ADD_TAG", order: 2, config: { tag: "Major Gift" } },
      { type: "ADD_TIMELINE", order: 3, config: { note: "Major gift follow-up workflow started" } },
    ],
  },
  {
    id: "preset-meeting-followup",
    name: "Meeting Follow-Up Workflow",
    description: "When a meeting is marked completed, create a follow-up task and add a timeline entry.",
    trigger: "MEETING_COMPLETED",
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Follow up after meeting", daysAfter: 2, category: "Meeting Follow-Up" } },
      { type: "ADD_TIMELINE", order: 1, config: { note: "Meeting completed — follow-up assigned" } },
    ],
  },
  {
    id: "preset-meeting-scheduled",
    name: "Meeting Preparation Reminder",
    description: "When a meeting is scheduled, create a preparation task for the assigned staff member.",
    trigger: "MEETING_SCHEDULED",
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Prepare for upcoming meeting", category: "Meeting Prep", priority: "MEDIUM" } },
      { type: "ADD_TIMELINE", order: 1, config: { note: "Meeting scheduled" } },
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
    description: "When a donor has not given in 12 months, flag them and start an outreach workflow.",
    trigger: "DONOR_LAPSED",
    actions: [
      { type: "ADD_TAG", order: 0, config: { tag: "Lapsed Donor" } },
      { type: "CREATE_TASK", order: 1, config: { title: "Re-engage lapsed donor with personalized outreach", category: "Donor Follow-Up" } },
      { type: "SEND_EMAIL", order: 2, config: { template: "impact-story" } },
      { type: "ADD_TIMELINE", order: 3, config: { note: "Donor lapsed — re-engagement workflow started" } },
    ],
  },
  {
    id: "preset-pledge-reminder",
    name: "Pledge Payment Reminder",
    description: "When a pledge payment date is approaching, create a reminder task and optionally notify the donor.",
    trigger: "PLEDGE_DUE_SOON",
    actions: [
      { type: "CREATE_TASK", order: 0, config: { title: "Follow up on upcoming pledge payment", category: "Pledge Follow-Up", priority: "HIGH" } },
      { type: "NOTIFY_STAFF", order: 1, config: { message: "Pledge payment approaching — please review" } },
    ],
  },
] as const;

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
