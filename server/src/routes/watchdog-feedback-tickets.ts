/** Watchdog ticket triage routes for viewing, assigning, and resolving cross-CRM feedback. */
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/requireRole.js";
import { recordWatchdogSecurityEvent } from "../services/watchdog-store.js";

const router = Router();

const FEEDBACK_TYPES = [
  "bug_report",
  "feature_request",
  "feature_change",
  "confusing_ui",
  "data_issue",
  "general_feedback",
] as const;
const TICKET_STATUSES = ["new", "in_review", "in_progress", "waiting_on_user", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const CRM_SCOPES = ["donor", "compassion", "events", "watchdog", "webmaster", "hrm", "reportit", "other", "unknown"] as const;

const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  organizationId: true,
  type: true,
  status: true,
  priority: true,
  crmScope: true,
  pageUrl: true,
  routePath: true,
  pageTitle: true,
  submittedByUserId: true,
  submittedByName: true,
  submittedByEmail: true,
  whatTryingToDo: true,
  whatHappened: true,
  expectedResult: true,
  extraComments: true,
  featureTitle: true,
  featureProblem: true,
  featureAudience: true,
  featureRequestedChange: true,
  importance: true,
  browserInfo: true,
  deviceInfo: true,
  appVersion: true,
  environment: true,
  assignedDeveloperId: true,
  assignedToPersonId: true,
  developerNotes: true,
  resolutionNotes: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  submittedByUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
  assignedDeveloper: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.WatchdogFeedbackTicketSelect;

type TicketRecord = Prisma.WatchdogFeedbackTicketGetPayload<{ select: typeof TICKET_SELECT }>;

router.use(requireAuth, requireRole("admin"));

/** Trims one optional string and bounds it for safe persistence. */
function readOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Reads one enum-like filter as a validated string list from query text. */
function parseFilterList<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const values = raw.filter((item): item is T => (allowed as readonly string[]).includes(item));
  return values.length > 0 ? values : undefined;
}

/** Converts query date text to Date when valid. */
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Builds a stable display name from one optional user-like object. */
function displayName(user: { firstName: string; lastName: string; email: string } | null | undefined): string | null {
  if (!user) return null;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return fullName || user.email || null;
}

/** Computes a security severity from one ticket priority. */
function severityFromPriority(priority: string): "low" | "medium" | "high" | "critical" {
  if (priority === "urgent") return "critical";
  if (priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

/** Shapes one database ticket record for frontend use. */
function formatTicket(ticket: TicketRecord) {
  return {
    ...ticket,
    submittedByDisplayName: displayName(ticket.submittedByUser) ?? ticket.submittedByName ?? ticket.submittedByEmail,
    assignedDeveloperDisplayName: displayName(ticket.assignedDeveloper),
  };
}

/** Checks whether one authenticated user has one fine-grained permission key. */
async function hasPermission(req: Request, permission: PermissionKey): Promise<boolean> {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId || !role) return false;

  const override = await prisma.userPermission.findUnique({
    where: {
      userId_permission: {
        userId,
        permission,
      },
    },
    select: { granted: true },
  });

  if (override) return Boolean(override.granted);
  return hasDefaultPermission(role, permission);
}

/** Writes a standard permission-denied response and returns false when access is blocked. */
async function enforcePermission(req: Request, res: Response, permission: PermissionKey): Promise<boolean> {
  const allowed = await hasPermission(req, permission);
  if (!allowed) {
    res.status(403).json({
      error: {
        code: "PERMISSION_DENIED",
        message: `Permission denied: ${permission}`,
      },
    });
    return false;
  }
  return true;
}

/**
 * GET /api/watchdog/feedback-tickets/summary
 * Returns dashboard cards and grouped counts for triage planning.
 */
router.get("/summary", requirePermission("watchdog.tickets.view"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const [
    total,
    unresolved,
    unassigned,
    urgentCount,
    highCount,
    openOver72h,
    byStatus,
    byType,
    byScope,
    byPriority,
  ] = await prisma.$transaction([
    prisma.watchdogFeedbackTicket.count({ where: { organizationId } }),
    prisma.watchdogFeedbackTicket.count({ where: { organizationId, status: { in: ["new", "in_review", "in_progress", "waiting_on_user"] } } }),
    prisma.watchdogFeedbackTicket.count({ where: { organizationId, assignedDeveloperId: null, status: { notIn: ["closed"] } } }),
    prisma.watchdogFeedbackTicket.count({ where: { organizationId, priority: "urgent" } }),
    prisma.watchdogFeedbackTicket.count({ where: { organizationId, priority: "high" } }),
    prisma.watchdogFeedbackTicket.count({
      where: {
        organizationId,
        status: { in: ["new", "in_review", "in_progress", "waiting_on_user"] },
        createdAt: { lte: seventyTwoHoursAgo },
      },
    }),
    prisma.watchdogFeedbackTicket.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.watchdogFeedbackTicket.groupBy({ by: ["type"], where: { organizationId }, _count: { _all: true } }),
    prisma.watchdogFeedbackTicket.groupBy({ by: ["crmScope"], where: { organizationId }, _count: { _all: true } }),
    prisma.watchdogFeedbackTicket.groupBy({ by: ["priority"], where: { organizationId }, _count: { _all: true } }),
  ]);

  res.json({
    totals: {
      total,
      unresolved,
      unassigned,
      urgent: urgentCount,
      high: highCount,
      openOver72h,
    },
    groups: {
      byStatus,
      byType,
      byScope,
      byPriority,
    },
  });
});

/**
 * GET /api/watchdog/feedback-tickets/developers
 * Returns assignable users for ticket ownership.
 */
router.get("/developers", requirePermission("watchdog.tickets.view"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const items = await prisma.user.findMany({
    where: {
      organizationId,
      active: true,
      role: { in: ["admin", "manager", "staff"] },
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
  });

  res.json({
    items: items.map((item) => ({
      ...item,
      displayName: displayName(item) ?? item.email,
    })),
  });
});

/**
 * GET /api/watchdog/feedback-tickets
 * Returns a paginated triage queue with filters and text search.
 */
router.get("/", requirePermission("watchdog.tickets.view"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 100);
  const offset = (page - 1) * limit;

  const statuses = parseFilterList(req.query.status, TICKET_STATUSES);
  const types = parseFilterList(req.query.type, FEEDBACK_TYPES);
  const priorities = parseFilterList(req.query.priority, PRIORITIES);
  const scopes = parseFilterList(req.query.crmScope, CRM_SCOPES);

  const assignedTo = readOptionalString(req.query.assignedTo, 120);
  const submittedBy = readOptionalString(req.query.submittedBy, 120);
  const environment = readOptionalString(req.query.environment, 120);
  const search = readOptionalString(req.query.search, 160);

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);

  const where: Prisma.WatchdogFeedbackTicketWhereInput = { organizationId };

  if (statuses) where.status = { in: statuses };
  if (types) where.type = { in: types };
  if (priorities) where.priority = { in: priorities };
  if (scopes) where.crmScope = { in: scopes };

  if (assignedTo === "unassigned") {
    where.assignedDeveloperId = null;
  } else if (assignedTo) {
    where.assignedDeveloperId = assignedTo;
  }

  if (submittedBy) {
    where.submittedByUserId = submittedBy;
  }

  if (environment) {
    where.environment = environment;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  if (search) {
    where.OR = [
      { ticketNumber: { contains: search } },
      { whatTryingToDo: { contains: search } },
      { whatHappened: { contains: search } },
      { expectedResult: { contains: search } },
      { featureTitle: { contains: search } },
      { featureProblem: { contains: search } },
      { featureRequestedChange: { contains: search } },
      { developerNotes: { contains: search } },
      { resolutionNotes: { contains: search } },
      { pageUrl: { contains: search } },
      { submittedByName: { contains: search } },
      { submittedByEmail: { contains: search } },
    ];
  }

  const sortByQuery = readOptionalString(req.query.sortBy, 40);
  const sortDirection = readOptionalString(req.query.sortDirection, 4) === "asc" ? "asc" : "desc";
  const sortBy = sortByQuery === "updatedAt" ? "updatedAt" : "createdAt";

  const [total, items] = await prisma.$transaction([
    prisma.watchdogFeedbackTicket.count({ where }),
    prisma.watchdogFeedbackTicket.findMany({
      where,
      orderBy: { [sortBy]: sortDirection },
      skip: offset,
      take: limit,
      select: TICKET_SELECT,
    }),
  ]);

  res.json({
    items: items.map(formatTicket),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});

/**
 * GET /api/watchdog/feedback-tickets/:id
 * Returns one full ticket with all triage notes and context.
 */
router.get("/:id", requirePermission("watchdog.tickets.view"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const id = req.params.id;
  const item = await prisma.watchdogFeedbackTicket.findFirst({
    where: { id, organizationId },
    select: TICKET_SELECT,
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    return;
  }

  res.json({ item: formatTicket(item) });
});

/**
 * PATCH /api/watchdog/feedback-tickets/:id
 * Updates triage status, assignment, and notes for one feedback ticket.
 */
router.patch("/:id", requirePermission("watchdog.tickets.manage"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const id = req.params.id;
  const current = await prisma.watchdogFeedbackTicket.findFirst({
    where: { id, organizationId },
    select: TICKET_SELECT,
  });

  if (!current) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    return;
  }

  const status = readOptionalString(req.body.status, 40);
  const priority = readOptionalString(req.body.priority, 20);
  const assignedDeveloperIdInput = req.body.assignedDeveloperId;
  const assignedToPersonId = readOptionalString(req.body.assignedToPersonId, 120);
  const developerNotes = readOptionalString(req.body.developerNotes, 15000);
  const resolutionNotes = readOptionalString(req.body.resolutionNotes, 15000);

  if (status && !(TICKET_STATUSES as readonly string[]).includes(status)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid status value" } });
    return;
  }
  if (priority && !(PRIORITIES as readonly string[]).includes(priority)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid priority value" } });
    return;
  }

  let assignedDeveloperId: string | null | undefined;
  if (assignedDeveloperIdInput === null) {
    assignedDeveloperId = null;
  } else {
    const normalizedAssignedDeveloperId = readOptionalString(assignedDeveloperIdInput, 120);
    if (normalizedAssignedDeveloperId) {
      assignedDeveloperId = normalizedAssignedDeveloperId;
    }
  }

  if (assignedDeveloperId !== undefined || assignedToPersonId !== null) {
    const allowedToAssign = await enforcePermission(req, res, "watchdog.tickets.assign");
    if (!allowedToAssign) return;
  }

  if (status && (status === "resolved" || status === "closed")) {
    const allowedToResolve = await enforcePermission(req, res, "watchdog.tickets.resolve");
    if (!allowedToResolve) return;
  }

  if (assignedDeveloperId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedDeveloperId,
        organizationId,
        active: true,
      },
      select: { id: true },
    });

    if (!assignee) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Assigned developer must be an active user in this organization.",
        },
      });
      return;
    }
  }

  const resolvedAtUpdate = status
    ? (status === "resolved" || status === "closed" ? new Date() : null)
    : undefined;

  const updateData: Prisma.WatchdogFeedbackTicketUpdateInput = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assignedDeveloperId !== undefined ? { assignedDeveloperId } : {}),
    ...(assignedToPersonId !== null ? { assignedToPersonId } : {}),
    ...(developerNotes !== null ? { developerNotes } : {}),
    ...(resolutionNotes !== null ? { resolutionNotes } : {}),
    ...(resolvedAtUpdate !== undefined ? { resolvedAt: resolvedAtUpdate } : {}),
  };

  const updated = await prisma.watchdogFeedbackTicket.update({
    where: { id: current.id },
    data: updateData,
    select: TICKET_SELECT,
  });

  await logAudit({
    action: "WATCHDOG_FEEDBACK_TICKET_UPDATED",
    entity: "WatchdogFeedbackTicket",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      ticketNumber: updated.ticketNumber,
      previousStatus: current.status,
      nextStatus: updated.status,
      previousPriority: current.priority,
      nextPriority: updated.priority,
      assignedDeveloperId: updated.assignedDeveloperId,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: severityFromPriority(updated.priority),
      eventType: "WATCHDOG_FEEDBACK_TICKET_UPDATED",
      sourceModule: "watchdog",
      message: `Feedback ticket ${updated.ticketNumber} updated`,
      payload: {
        ticketId: updated.id,
        ticketNumber: updated.ticketNumber,
        previousStatus: current.status,
        status: updated.status,
        priority: updated.priority,
        assignedDeveloperId: updated.assignedDeveloperId,
        actorUserId: userId,
      },
    });
  } catch {
    // No-op: triage updates should succeed even when external Watchdog event writes fail.
  }

  res.json({ item: formatTicket(updated) });
});

/**
 * POST /api/watchdog/feedback-tickets/:id/resolve
 * Resolves one ticket and stores optional resolution notes.
 */
router.post("/:id/resolve", requirePermission("watchdog.tickets.resolve"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const id = req.params.id;
  const item = await prisma.watchdogFeedbackTicket.findFirst({
    where: { id, organizationId },
    select: TICKET_SELECT,
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    return;
  }

  const resolutionNotes = readOptionalString(req.body.resolutionNotes, 15000);

  const updated = await prisma.watchdogFeedbackTicket.update({
    where: { id },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      ...(resolutionNotes ? { resolutionNotes } : {}),
    },
    select: TICKET_SELECT,
  });

  await logAudit({
    action: "WATCHDOG_FEEDBACK_TICKET_RESOLVED",
    entity: "WatchdogFeedbackTicket",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      ticketNumber: updated.ticketNumber,
      previousStatus: item.status,
      status: updated.status,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ item: formatTicket(updated) });
});

/**
 * POST /api/watchdog/feedback-tickets/:id/reopen
 * Reopens one resolved or closed ticket for additional triage.
 */
router.post("/:id/reopen", requirePermission("watchdog.tickets.resolve"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const id = req.params.id;
  const item = await prisma.watchdogFeedbackTicket.findFirst({
    where: { id, organizationId },
    select: TICKET_SELECT,
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    return;
  }

  const updated = await prisma.watchdogFeedbackTicket.update({
    where: { id },
    data: {
      status: "in_review",
      resolvedAt: null,
    },
    select: TICKET_SELECT,
  });

  await logAudit({
    action: "WATCHDOG_FEEDBACK_TICKET_REOPENED",
    entity: "WatchdogFeedbackTicket",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      ticketNumber: updated.ticketNumber,
      previousStatus: item.status,
      status: updated.status,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ item: formatTicket(updated) });
});

/**
 * DELETE /api/watchdog/feedback-tickets/:id
 * Permanently deletes one ticket when cleanup is explicitly required.
 */
router.delete("/:id", requirePermission("watchdog.tickets.delete"), async (req: Request, res: Response) => {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization found" } });
    return;
  }

  const id = req.params.id;
  const item = await prisma.watchdogFeedbackTicket.findFirst({
    where: { id, organizationId },
    select: { id: true, ticketNumber: true, status: true },
  });

  if (!item) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket not found" } });
    return;
  }

  await prisma.watchdogFeedbackTicket.delete({ where: { id: item.id } });

  await logAudit({
    action: "WATCHDOG_FEEDBACK_TICKET_DELETED",
    entity: "WatchdogFeedbackTicket",
    entityId: item.id,
    userId,
    organizationId,
    metadata: {
      ticketNumber: item.ticketNumber,
      status: item.status,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ success: true });
});

/** Exposes Watchdog triage routes for feedback ticket operations. */
export default router;
