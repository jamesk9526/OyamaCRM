/**
 * Grant Management routes for OyamaCRM.
 * Covers the grant research case-file lifecycle: funder tracking, application status,
 * grant writing sections, deadlines/tasks/resources case items, and activity timeline.
 *
 * Routes:
 *   -- Grant Funders --
 *   GET   /api/grants/funders            — list all funders for the org
 *   POST  /api/grants/funders            — create a new funder (manager+)
 *   PATCH /api/grants/funders/:id        — update funder details (manager+)
 *   DELETE /api/grants/funders/:id       — delete a funder (admin only)
 *
 *   -- Grants --
 *   GET   /api/grants                    — list all grants with funder + assignee
 *   GET   /api/grants/stats              — summary counts for research, deadlines, and decisions
 *   POST  /api/grants                    — create a new grant (manager+)
 *   GET   /api/grants/:id                — single grant with sections + recent activity
 *   PATCH /api/grants/:id                — update grant fields (staff+)
 *   DELETE /api/grants/:id               — delete grant (manager+)
 *
 *   -- Writing Sections --
 *   GET   /api/grants/:id/sections       — list all writing sections for a grant
 *   PATCH /api/grants/:id/sections/:key  — update a single section's content / completion
 *
 *   -- Activity / Notes --
 *   GET   /api/grants/:id/activity       — list activity timeline for a grant
 *   POST  /api/grants/:id/activity       — add a note or activity entry
 *
 *   -- Case File Items --
 *   GET   /api/grants/workspace/case-items — cross-grant reminders/tasks/resources/requirements
 *   GET   /api/grants/:id/case-items       — case-file items for one grant
 *   POST  /api/grants/:id/case-items       — create one case-file item
 *   PATCH /api/grants/:id/case-items/:itemId — update one case-file item
 *
 * @module routes/grants
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/requireRole.js";
import type { GrantStatus, Prisma } from "@prisma/client";

const router = Router();

// All grant routes require authentication.
router.use(requireAuth);

// ─── Default writing sections seeded on every new grant ──────────────────────

/** Standard grant proposal sections auto-created with every new grant. */
const DEFAULT_SECTIONS = [
  { key: "executive_summary",  title: "Executive Summary",  wordLimit: 500,  sortOrder: 0 },
  { key: "need_statement",     title: "Need Statement",     wordLimit: 750,  sortOrder: 1 },
  { key: "program_description",title: "Program Description",wordLimit: 1500, sortOrder: 2 },
  { key: "goals_objectives",   title: "Goals & Objectives", wordLimit: 500,  sortOrder: 3 },
  { key: "evaluation_plan",    title: "Evaluation Plan",    wordLimit: 750,  sortOrder: 4 },
  { key: "budget_narrative",   title: "Budget Narrative",   wordLimit: 1000, sortOrder: 5 },
  { key: "org_background",     title: "Organization Background", wordLimit: 500, sortOrder: 6 },
  { key: "sustainability_plan",title: "Sustainability Plan",wordLimit: 500,  sortOrder: 7 },
  { key: "loi_narrative",      title: "Letter of Intent (LOI)", wordLimit: 1000, sortOrder: 8 },
];

/**
 * Legacy + canonical status aliases normalized into current GrantStatus enum values.
 * This prevents runtime Prisma validation errors from older clients while keeping DB values canonical.
 */
const GRANT_STATUS_ALIASES: Record<string, GrantStatus> = {
  IDEA: "IDEA",
  PROSPECTING: "RESEARCH",
  RESEARCH: "RESEARCH",
  LOI_DRAFT: "LOI_DRAFT",
  LOI_SUBMITTED: "LOI_SUBMITTED",
  PROPOSAL_DRAFT: "PROPOSAL_DRAFT",
  SUBMITTED: "PROPOSAL_SUBMITTED",
  PROPOSAL_SUBMITTED: "PROPOSAL_SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  IN_REVIEW: "UNDER_REVIEW",
  AWARDED: "AWARDED",
  REJECTED: "REJECTED",
  DECLINED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  CLOSED: "CLOSED",
};

/** Normalizes inbound status values to supported GrantStatus values. */
function parseGrantStatus(value: unknown): GrantStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return GRANT_STATUS_ALIASES[normalized] ?? null;
}

// ─── Grant case-file items (reminders/tasks/resources/requirements) ────────

const CASE_ITEM_KINDS = ["REMINDER", "TASK", "RESOURCE", "REQUIREMENT"] as const;
type CaseItemKind = (typeof CASE_ITEM_KINDS)[number];

type CaseItemPermission = "grants.manage_deadlines" | "grants.manage_tasks" | "grants.manage_resources";

/** Parses case-file kind values from route/query/body payloads. */
function parseCaseItemKind(value: unknown): CaseItemKind | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return CASE_ITEM_KINDS.includes(normalized as CaseItemKind) ? (normalized as CaseItemKind) : null;
}

/** Returns the permission key required to mutate one case-file kind. */
function permissionForCaseItemKind(kind: CaseItemKind): CaseItemPermission {
  if (kind === "REMINDER") return "grants.manage_deadlines";
  if (kind === "RESOURCE") return "grants.manage_resources";
  return "grants.manage_tasks";
}

/** Returns null for empty strings and non-string-ish values. */
function toOptionalString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

/** Converts unknown date payloads to Date/null for persistence. */
function toOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Type guard for JSON metadata objects. */
function isMetadataObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalizes one grant activity row into a case-file item shape when possible. */
function mapActivityToCaseItem(activity: {
  id: string;
  grantId: string;
  description: string;
  metadata: unknown;
  createdAt: Date;
  grant?: {
    id: string;
    title: string;
    status: GrantStatus;
    funder?: { name: string } | null;
  };
}) {
  if (!isMetadataObject(activity.metadata)) return null;
  if (activity.metadata.caseItem !== true) return null;

  const kind = parseCaseItemKind(activity.metadata.kind);
  if (!kind) return null;

  return {
    id: activity.id,
    grantId: activity.grantId,
    kind,
    title: toOptionalString(activity.metadata.title) ?? activity.description,
    description: toOptionalString(activity.metadata.description),
    status: toOptionalString(activity.metadata.status),
    priority: toOptionalString(activity.metadata.priority),
    taskType: toOptionalString(activity.metadata.taskType),
    reminderType: toOptionalString(activity.metadata.reminderType),
    resourceType: toOptionalString(activity.metadata.resourceType),
    dueAt: toOptionalString(activity.metadata.dueAt),
    remindAt: toOptionalString(activity.metadata.remindAt),
    assignedToId: toOptionalString(activity.metadata.assignedToId),
    assignedToName: toOptionalString(activity.metadata.assignedToName),
    url: toOptionalString(activity.metadata.url),
    pinned: Boolean(activity.metadata.pinned),
    createdAt: activity.createdAt,
    ...(activity.grant
      ? {
          grant: {
            id: activity.grant.id,
            title: activity.grant.title,
            status: activity.grant.status,
            funderName: activity.grant.funder?.name ?? null,
          },
        }
      : {}),
  };
}

// ─── Funder routes ────────────────────────────────────────────────────────────

/** GET /api/grants/funders — List all funders for the org, sorted by name. */
router.get("/funders", requirePermission("grants.view"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }

  const funders = await prisma.grantFunder.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { grants: true } } },
  });

  res.json(funders);
});

/** POST /api/grants/funders — Create a new grant funder. Requires manager+ role. */
router.post("/funders", requirePermission("grants.manage_funders"), requireRole("manager"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.status(400).json({ error: { message: "No organization found" } }); return; }

  const { name, type, website, contactName, contactEmail, contactPhone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: { message: "name is required" } }); return; }

  const funder = await prisma.grantFunder.create({
    data: { organizationId, name, type, website, contactName, contactEmail, contactPhone, address, notes },
  });

  await logAudit({ action: "CREATE", entity: "GrantFunder", entityId: funder.id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.status(201).json(funder);
});

/** PATCH /api/grants/funders/:id — Update funder fields. Requires manager+ role. */
router.patch("/funders/:id", requirePermission("grants.manage_funders"), requireRole("manager"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const allowed = ["name","type","website","contactName","contactEmail","contactPhone","address","notes","active"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in req.body) data[k] = req.body[k];

  const funder = await prisma.grantFunder.updateMany({
    where: { id, organizationId: organizationId ?? "" },
    data,
  });
  if (!funder.count) { res.status(404).json({ error: { message: "Funder not found" } }); return; }

  await logAudit({ action: "UPDATE", entity: "GrantFunder", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  const updated = await prisma.grantFunder.findUnique({ where: { id } });
  res.json({ ...(updated ?? {}), updated: funder.count });
});

/** DELETE /api/grants/funders/:id — Remove a funder (admin only). */
router.delete("/funders/:id", requirePermission("grants.delete"), requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const result = await prisma.grantFunder.deleteMany({
    where: { id, organizationId: organizationId ?? "" },
  });
  if (!result.count) { res.status(404).json({ error: { message: "Funder not found" } }); return; }
  await logAudit({ action: "DELETE", entity: "GrantFunder", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json({ success: true });
});

// ─── Grant stats ──────────────────────────────────────────────────────────────

/**
 * GET /api/grants/stats — Aggregated pipeline stats: count/amount by status,
 * total requested, total awarded, and upcoming deadline count.
 */
router.get("/stats", requirePermission("grants.view"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ byStatus: {}, totalRequested: 0, totalAwarded: 0, upcomingDeadlines: 0 });
    return;
  }

  const grants = await prisma.grant.findMany({
    where: { organizationId },
    select: {
      status: true,
      amountRequested: true,
      amountAwarded: true,
      applicationDeadline: true,
      reportingDeadline: true,
      reportingSubmittedAt: true,
    },
  });

  const byStatus: Record<string, { count: number; totalRequested: number }> = {};
  let totalRequested = 0;
  let totalAwarded = 0;
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  let upcomingDeadlines = 0;
  let applicationsInProgress = 0;
  let submittedAwaitingDecision = 0;
  let reportsDue = 0;
  let renewalsComingUp = 0;

  for (const g of grants) {
    const s = g.status;
    if (!byStatus[s]) byStatus[s] = { count: 0, totalRequested: 0 };
    byStatus[s].count++;
    const amt = Number(g.amountRequested ?? 0);
    byStatus[s].totalRequested += amt;
    totalRequested += amt;
    totalAwarded += Number(g.amountAwarded ?? 0);

    if (g.status === "LOI_DRAFT" || g.status === "LOI_SUBMITTED" || g.status === "PROPOSAL_DRAFT") {
      applicationsInProgress++;
    }
    if (g.status === "PROPOSAL_SUBMITTED" || g.status === "UNDER_REVIEW") {
      submittedAwaitingDecision++;
    }

    if (g.applicationDeadline && g.applicationDeadline <= in30days && g.applicationDeadline >= new Date()) {
      upcomingDeadlines++;
    }

    if (
      g.status === "AWARDED" &&
      g.reportingDeadline &&
      !g.reportingSubmittedAt &&
      g.reportingDeadline <= in30days &&
      g.reportingDeadline >= new Date()
    ) {
      reportsDue++;
    }

    if (
      g.status === "AWARDED" &&
      g.reportingDeadline &&
      g.reportingDeadline <= in90days &&
      g.reportingDeadline >= in30days
    ) {
      renewalsComingUp++;
    }
  }

  res.json({
    byStatus,
    totalRequested,
    totalAwarded,
    total: grants.length,
    upcomingDeadlines,
    applicationsInProgress,
    submittedAwaitingDecision,
    reportsDue,
    renewalsComingUp,
  });
});

// ─── Grant list ───────────────────────────────────────────────────────────────

/**
 * GET /api/grants — List all grants for the org.
 * Supports ?status=IDEA&assigneeId=xxx filters.
 */
router.get("/", requirePermission("grants.view"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }

  const where: Record<string, unknown> = { organizationId };
  if (req.query.status) {
    const parsedStatus = parseGrantStatus(String(req.query.status));
    if (!parsedStatus) {
      res.status(400).json({ error: { message: "Invalid grant status filter" } });
      return;
    }
    where.status = parsedStatus;
  }
  if (req.query.assigneeId) where.assigneeId = String(req.query.assigneeId);

  const grants = await prisma.grant.findMany({
    where,
    orderBy: [{ applicationDeadline: "asc" }, { createdAt: "desc" }],
    include: {
      funder: { select: { id: true, name: true, type: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { sections: true, activities: true } },
    },
  });

  res.json(grants);
});

/** POST /api/grants — Create a new grant and seed default writing sections. Requires manager+. */
router.post("/", requirePermission("grants.create"), requireRole("manager"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.status(400).json({ error: { message: "No organization found" } }); return; }

  const { funderId, title, programArea, status, amountRequested, requiresLOI,
          loiDeadline, applicationDeadline, assigneeId, notes, internalNotes } = req.body;

  if (!funderId || !title) {
    res.status(400).json({ error: { message: "funderId and title are required" } });
    return;
  }

  const funder = await prisma.grantFunder.findFirst({
    where: { id: String(funderId), organizationId },
    select: { id: true },
  });
  if (!funder) {
    res.status(404).json({ error: { message: "Funder not found" } });
    return;
  }

  const parsedStatus = parseGrantStatus(status);
  if (status !== undefined && parsedStatus === null) {
    res.status(400).json({ error: { message: "Invalid grant status" } });
    return;
  }

  const grant = await prisma.grant.create({
    data: {
      organizationId,
      funderId,
      title,
      programArea,
      status: parsedStatus ?? "IDEA",
      amountRequested: amountRequested ? Number(amountRequested) : undefined,
      requiresLOI: requiresLOI ?? false,
      loiDeadline: loiDeadline ? new Date(loiDeadline) : undefined,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
      assigneeId: assigneeId ?? null,
      notes,
      internalNotes,
      // Seed all default writing sections
      sections: {
        create: DEFAULT_SECTIONS,
      },
    },
    include: {
      funder: { select: { id: true, name: true, type: true } },
      sections: true,
    },
  });

  // Record creation as the first activity
  await prisma.grantActivity.create({
    data: {
      grantId: grant.id,
      userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
      type: "STATUS_CHANGE",
      description: `Grant created with status: ${grant.status}`,
    },
  });

  await logAudit({ action: "CREATE", entity: "Grant", entityId: grant.id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.status(201).json(grant);
});

/** GET /api/grants/workspace/case-items — cross-grant case-file list for deadlines/tasks workspace views. */
router.get("/workspace/case-items", requirePermission("grants.view"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const kindFilter = req.query.kind ? parseCaseItemKind(req.query.kind) : null;
  if (req.query.kind && !kindFilter) {
    res.status(400).json({ error: { message: "Invalid case-item kind" } });
    return;
  }

  const statusFilter = toOptionalString(req.query.status)?.toUpperCase() ?? null;
  const assignedToFilter = toOptionalString(req.query.assignedToId);
  const dueBefore = toOptionalDate(req.query.dueBefore);

  const activities = await prisma.grantActivity.findMany({
    where: {
      grant: { organizationId },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      grant: {
        select: {
          id: true,
          title: true,
          status: true,
          funder: { select: { name: true } },
        },
      },
    },
  });

  const items = activities
    .map((activity) => mapActivityToCaseItem(activity))
    .filter((item): item is NonNullable<ReturnType<typeof mapActivityToCaseItem>> => Boolean(item))
    .filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (statusFilter && (item.status ?? "").toUpperCase() !== statusFilter) return false;
      if (assignedToFilter && item.assignedToId !== assignedToFilter) return false;
      if (dueBefore && item.dueAt) {
        const dueDate = new Date(item.dueAt);
        if (!Number.isNaN(dueDate.getTime()) && dueDate > dueBefore) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

  res.json(items);
});

/** GET /api/grants/:id/case-items — case-file list for one grant. */
router.get("/:id/case-items", requirePermission("grants.view"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });

  const grant = await prisma.grant.findFirst({ where: { id, organizationId: organizationId ?? "" }, select: { id: true } });
  if (!grant) {
    res.status(404).json({ error: { message: "Grant not found" } });
    return;
  }

  const kindFilter = req.query.kind ? parseCaseItemKind(req.query.kind) : null;
  if (req.query.kind && !kindFilter) {
    res.status(400).json({ error: { message: "Invalid case-item kind" } });
    return;
  }

  const statusFilter = toOptionalString(req.query.status)?.toUpperCase() ?? null;

  const activities = await prisma.grantActivity.findMany({
    where: { grantId: id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const items = activities
    .map((activity) => mapActivityToCaseItem(activity))
    .filter((item): item is NonNullable<ReturnType<typeof mapActivityToCaseItem>> => Boolean(item))
    .filter((item) => {
      if (kindFilter && item.kind !== kindFilter) return false;
      if (statusFilter && (item.status ?? "").toUpperCase() !== statusFilter) return false;
      return true;
    });

  res.json(items);
});

/** POST /api/grants/:id/case-items — create one reminder/task/resource/requirement case-file row. */
router.post("/:id/case-items", async (req, res) => {
  const id = String(req.params.id);
  const kind = parseCaseItemKind(req.body.kind);
  if (!kind) {
    res.status(400).json({ error: { message: "Invalid case-item kind" } });
    return;
  }

  const permission = permissionForCaseItemKind(kind);
  return requirePermission(permission)(req, res, async () => {
    const organizationId = await resolveOrganizationId({ req });
    const grant = await prisma.grant.findFirst({ where: { id, organizationId: organizationId ?? "" }, select: { id: true } });
    if (!grant) {
      res.status(404).json({ error: { message: "Grant not found" } });
      return;
    }

    const title = toOptionalString(req.body.title);
    if (!title) {
      res.status(400).json({ error: { message: "title is required" } });
      return;
    }

    const url = toOptionalString(req.body.url);
    if (kind === "RESOURCE" && !url) {
      res.status(400).json({ error: { message: "url is required for resource items" } });
      return;
    }

    const assignedToId = toOptionalString(req.body.assignedToId);
    let assignedToName: string | null = null;
    if (assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assignedToId, organizationId: organizationId ?? "" },
        select: { firstName: true, lastName: true },
      });
      if (!assignee) {
        res.status(400).json({ error: { message: "assignedToId is not a valid org user" } });
        return;
      }
      assignedToName = `${assignee.firstName} ${assignee.lastName}`.trim();
    }

    const defaultStatusByKind: Record<CaseItemKind, string> = {
      REMINDER: "PENDING",
      TASK: "NOT_STARTED",
      RESOURCE: "ACTIVE",
      REQUIREMENT: "NOT_STARTED",
    };

    const metadata: Record<string, unknown> = {
      caseItem: true,
      kind,
      title,
      description: toOptionalString(req.body.description),
      status: toOptionalString(req.body.status)?.toUpperCase() ?? defaultStatusByKind[kind],
      priority: toOptionalString(req.body.priority)?.toUpperCase() ?? "MEDIUM",
      taskType: kind === "TASK" ? toOptionalString(req.body.taskType) : null,
      reminderType: kind === "REMINDER" ? toOptionalString(req.body.reminderType) : null,
      resourceType: kind === "RESOURCE" ? toOptionalString(req.body.resourceType) : null,
      dueAt: toOptionalDate(req.body.dueAt)?.toISOString() ?? null,
      remindAt: toOptionalDate(req.body.remindAt)?.toISOString() ?? null,
      assignedToId,
      assignedToName,
      url,
      pinned: kind === "RESOURCE" ? Boolean(req.body.pinned) : false,
    };

    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined || value === "") {
        delete metadata[key];
      }
    }

    const created = await prisma.grantActivity.create({
      data: {
        grantId: id,
        userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
        type: kind === "RESOURCE" ? "DOCUMENT_ADDED" : "OTHER",
        description: title,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    const mapped = mapActivityToCaseItem(created);
    if (!mapped) {
      res.status(500).json({ error: { message: "Failed to serialize case item" } });
      return;
    }

    await logAudit({
      action: "CREATE",
      entity: "GrantCaseItem",
      entityId: created.id,
      userId: (req as { user?: { sub?: string } }).user?.sub,
      metadata: { grantId: id, kind },
    });

    res.status(201).json(mapped);
  });
});

/** PATCH /api/grants/:id/case-items/:itemId — update one case-file row. */
router.patch("/:id/case-items/:itemId", async (req, res) => {
  const id = String(req.params.id);
  const itemId = String(req.params.itemId);
  const organizationId = await resolveOrganizationId({ req });

  const existing = await prisma.grantActivity.findFirst({
    where: {
      id: itemId,
      grantId: id,
      grant: { organizationId: organizationId ?? "" },
    },
    select: {
      id: true,
      grantId: true,
      description: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (!existing) {
    res.status(404).json({ error: { message: "Case item not found" } });
    return;
  }

  const existingCaseItem = mapActivityToCaseItem(existing);
  if (!existingCaseItem) {
    res.status(404).json({ error: { message: "Case item not found" } });
    return;
  }

  const permission = permissionForCaseItemKind(existingCaseItem.kind);
  return requirePermission(permission)(req, res, async () => {
    const metadata = isMetadataObject(existing.metadata) ? { ...existing.metadata } : {};

    if ("title" in req.body) {
      const nextTitle = toOptionalString(req.body.title);
      if (!nextTitle) {
        res.status(400).json({ error: { message: "title cannot be empty" } });
        return;
      }
      metadata.title = nextTitle;
    }

    if ("description" in req.body) metadata.description = toOptionalString(req.body.description);
    if ("status" in req.body) metadata.status = toOptionalString(req.body.status)?.toUpperCase();
    if ("priority" in req.body) metadata.priority = toOptionalString(req.body.priority)?.toUpperCase();
    if ("taskType" in req.body) metadata.taskType = toOptionalString(req.body.taskType);
    if ("reminderType" in req.body) metadata.reminderType = toOptionalString(req.body.reminderType);
    if ("resourceType" in req.body) metadata.resourceType = toOptionalString(req.body.resourceType);
    if ("dueAt" in req.body) metadata.dueAt = toOptionalDate(req.body.dueAt)?.toISOString() ?? null;
    if ("remindAt" in req.body) metadata.remindAt = toOptionalDate(req.body.remindAt)?.toISOString() ?? null;

    if ("assignedToId" in req.body) {
      const assignedToId = toOptionalString(req.body.assignedToId);
      metadata.assignedToId = assignedToId;
      if (assignedToId) {
        const assignee = await prisma.user.findFirst({
          where: { id: assignedToId, organizationId: organizationId ?? "" },
          select: { firstName: true, lastName: true },
        });
        if (!assignee) {
          res.status(400).json({ error: { message: "assignedToId is not a valid org user" } });
          return;
        }
        metadata.assignedToName = `${assignee.firstName} ${assignee.lastName}`.trim();
      } else {
        metadata.assignedToName = null;
      }
    }

    if ("url" in req.body) metadata.url = toOptionalString(req.body.url);
    if ("pinned" in req.body) metadata.pinned = Boolean(req.body.pinned);

    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined || value === "") {
        delete metadata[key];
      }
    }

    const nextTitle = toOptionalString(metadata.title) ?? existing.description;

    const updated = await prisma.grantActivity.update({
      where: { id: itemId },
      data: {
        description: nextTitle,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    const mapped = mapActivityToCaseItem(updated);
    if (!mapped) {
      res.status(500).json({ error: { message: "Failed to serialize case item" } });
      return;
    }

    await logAudit({
      action: "UPDATE",
      entity: "GrantCaseItem",
      entityId: itemId,
      userId: (req as { user?: { sub?: string } }).user?.sub,
      metadata: { grantId: id, kind: existingCaseItem.kind },
    });

    res.json(mapped);
  });
});

/** GET /api/grants/:id — Full grant detail with sections and recent activity. */
router.get("/:id", requirePermission("grants.view"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });

  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    include: {
      funder: true,
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }
  res.json(grant);
});

/** PATCH /api/grants/:id — Update grant fields. Status changes are logged as activities. */
router.patch("/:id", requirePermission("grants.edit"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const existing = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { status: true },
  });
  if (!existing) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const allowed = [
    "title","funderId","programArea","status","amountRequested","amountAwarded",
    "requiresLOI","loiDeadline","loiSubmittedAt","applicationDeadline","submittedAt",
    "awardedAt","rejectedAt","grantPeriodStart","grantPeriodEnd",
    "reportingDeadline","reportingSubmittedAt","assigneeId","notes","internalNotes",
  ];
  const data: Record<string, unknown> = {};

  if ("funderId" in req.body) {
    const nextFunderId = String(req.body.funderId ?? "").trim();
    if (nextFunderId) {
      const funder = await prisma.grantFunder.findFirst({
        where: { id: nextFunderId, organizationId: organizationId ?? "" },
        select: { id: true },
      });
      if (!funder) {
        res.status(404).json({ error: { message: "Funder not found" } });
        return;
      }
      data.funderId = nextFunderId;
    } else {
      res.status(400).json({ error: { message: "funderId cannot be empty" } });
      return;
    }
  }

  if ("status" in req.body) {
    const parsedStatus = parseGrantStatus(req.body.status);
    if (String(req.body.status ?? "").trim() && !parsedStatus) {
      res.status(400).json({ error: { message: "Invalid grant status" } });
      return;
    }
    if (parsedStatus) {
      data.status = parsedStatus;
    }
  }

  for (const k of allowed) {
    if (k === "status" || k === "funderId") continue;
    if (k in req.body) {
      if (["loiDeadline","loiSubmittedAt","applicationDeadline","submittedAt",
           "awardedAt","rejectedAt","grantPeriodStart","grantPeriodEnd",
           "reportingDeadline","reportingSubmittedAt"].includes(k)) {
        data[k] = req.body[k] ? new Date(req.body[k]) : null;
      } else {
        data[k] = req.body[k];
      }
    }
  }

  const updated = await prisma.grant.update({
    where: { id },
    data,
    include: {
      funder: { select: { id: true, name: true, type: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Log status change as a timeline activity
  if (req.body.status && req.body.status !== existing.status) {
    const nextStatus = (data.status as GrantStatus | undefined) ?? existing.status;
    await prisma.grantActivity.create({
      data: {
        grantId: id,
        userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
        type: "STATUS_CHANGE",
        description: `Status changed from ${existing.status} to ${nextStatus}`,
        metadata: { from: existing.status, to: nextStatus },
      },
    });
  }

  await logAudit({ action: "UPDATE", entity: "Grant", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json(updated);
});

/** DELETE /api/grants/:id — Remove a grant (manager+). Cascade deletes sections & activities. */
router.delete("/:id", requirePermission("grants.delete"), requireRole("manager"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const result = await prisma.grant.deleteMany({
    where: { id, organizationId: organizationId ?? "" },
  });
  if (!result.count) { res.status(404).json({ error: { message: "Grant not found" } }); return; }
  await logAudit({ action: "DELETE", entity: "Grant", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json({ success: true });
});

// ─── Writing sections ─────────────────────────────────────────────────────────

/** GET /api/grants/:id/sections — List all writing sections for a grant, ordered. */
router.get("/:id/sections", requirePermission("grants.view"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const sections = await prisma.grantSection.findMany({
    where: { grantId: id },
    orderBy: { sortOrder: "asc" },
  });
  res.json(sections);
});

/**
 * PATCH /api/grants/:id/sections/:key — Update a section's content and/or completion.
 * Creates the section if it doesn't exist (for custom sections).
 */
router.patch("/:id/sections/:key", requirePermission("grants.edit"), async (req, res) => {
  const id = String(req.params.id);
  const key = String(req.params.key);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const { content, completed, title, wordLimit } = req.body;
  const section = await prisma.grantSection.upsert({
    where: { grantId_key: { grantId: id, key } },
    update: {
      ...(content !== undefined && { content }),
      ...(completed !== undefined && { completed }),
      ...(title !== undefined && { title }),
      ...(wordLimit !== undefined && { wordLimit }),
    },
    create: {
      grantId: id,
      key,
      title: title ?? key.replace(/_/g, " "),
      content,
      completed: completed ?? false,
      wordLimit: wordLimit ?? null,
    },
  });
  res.json(section);
});

// ─── Activity / Notes ─────────────────────────────────────────────────────────

/** GET /api/grants/:id/activity — Fetch the activity timeline for a grant. */
router.get("/:id/activity", requirePermission("grants.view"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const activities = await prisma.grantActivity.findMany({
    where: { grantId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json(activities);
});

/** POST /api/grants/:id/activity — Add a note or activity to the grant timeline. */
router.post("/:id/activity", requirePermission("grants.edit"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const { type } = req.body;
  const description = String(req.body.description ?? req.body.note ?? "").trim();
  if (!description) { res.status(400).json({ error: { message: "description is required" } }); return; }

  const activity = await prisma.grantActivity.create({
    data: {
      grantId: id,
      userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
      type: type ?? "NOTE",
      description,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(activity);
});

export default router;
