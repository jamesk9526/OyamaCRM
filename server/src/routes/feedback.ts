/** Cross-CRM feedback submission routes for end users and self-service ticket tracking. */
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
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
const CRM_SCOPES = ["donor", "compassion", "events", "watchdog", "webmaster", "hrm", "reportit", "other", "unknown"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const IMPORTANCE = ["low", "helpful", "important", "urgent"] as const;

interface FeedbackContextPayload {
  crmScope?: string;
  pageUrl?: string;
  routePath?: string;
  pageTitle?: string;
  browserInfo?: string;
  deviceInfo?: string;
  appVersion?: string;
  environment?: string;
}

interface FeedbackSubmitPayload {
  type?: string;
  priority?: string;
  importance?: string;
  whatTryingToDo?: string;
  whatHappened?: string;
  expectedResult?: string;
  extraComments?: string;
  featureTitle?: string;
  featureProblem?: string;
  featureAudience?: string;
  featureRequestedChange?: string;
  context?: FeedbackContextPayload;
}

interface NormalizedFeedbackPayload {
  type: (typeof FEEDBACK_TYPES)[number];
  priority: (typeof PRIORITIES)[number];
  importance: (typeof IMPORTANCE)[number] | null;
  whatTryingToDo: string | null;
  whatHappened: string | null;
  expectedResult: string | null;
  extraComments: string | null;
  featureTitle: string | null;
  featureProblem: string | null;
  featureAudience: string | null;
  featureRequestedChange: string | null;
  context: {
    crmScope: (typeof CRM_SCOPES)[number];
    pageUrl: string;
    routePath: string | null;
    pageTitle: string | null;
    browserInfo: string | null;
    deviceInfo: string | null;
    appVersion: string | null;
    environment: string | null;
  };
}

const MY_TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  type: true,
  status: true,
  priority: true,
  crmScope: true,
  pageUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WatchdogFeedbackTicketSelect;

/** Trims one string and converts empty values to null while applying a length guard. */
function readOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Converts a freeform feedback type into a validated enum value. */
function normalizeFeedbackType(value: unknown): (typeof FEEDBACK_TYPES)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return (FEEDBACK_TYPES as readonly string[]).includes(normalized) ? (normalized as (typeof FEEDBACK_TYPES)[number]) : null;
}

/** Converts one optional priority into a known queue priority. */
function normalizePriority(value: unknown): (typeof PRIORITIES)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return (PRIORITIES as readonly string[]).includes(normalized) ? (normalized as (typeof PRIORITIES)[number]) : null;
}

/** Converts one optional product-scope key into the server-safe scope set. */
function normalizeCrmScope(value: unknown): (typeof CRM_SCOPES)[number] {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim();
  return (CRM_SCOPES as readonly string[]).includes(normalized) ? (normalized as (typeof CRM_SCOPES)[number]) : "unknown";
}

/** Converts one optional feature importance value into a known level. */
function normalizeImportance(value: unknown): (typeof IMPORTANCE)[number] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return (IMPORTANCE as readonly string[]).includes(normalized) ? (normalized as (typeof IMPORTANCE)[number]) : null;
}

/** Maps feature importance values to queue priorities when the user did not pick a priority directly. */
function priorityFromImportance(importance: (typeof IMPORTANCE)[number] | null): (typeof PRIORITIES)[number] {
  if (importance === "urgent") return "urgent";
  if (importance === "important") return "high";
  if (importance === "helpful") return "normal";
  return "low";
}

/** Computes a security event severity level from queue priority. */
function securitySeverityFromPriority(priority: (typeof PRIORITIES)[number]): "low" | "medium" | "high" | "critical" {
  if (priority === "urgent") return "critical";
  if (priority === "high") return "high";
  if (priority === "normal") return "medium";
  return "low";
}

/** Validates and normalizes one feedback submission payload. */
function normalizeSubmissionPayload(payload: FeedbackSubmitPayload): NormalizedFeedbackPayload {
  const type = normalizeFeedbackType(payload.type);
  if (!type) {
    throw new Error("Feedback type is required.");
  }

  const whatTryingToDo = readOptionalString(payload.whatTryingToDo, 5000);
  const whatHappened = readOptionalString(payload.whatHappened, 7000);
  const expectedResult = readOptionalString(payload.expectedResult, 5000);
  const extraComments = readOptionalString(payload.extraComments, 7000);

  const featureTitle = readOptionalString(payload.featureTitle, 250);
  const featureProblem = readOptionalString(payload.featureProblem, 7000);
  const featureAudience = readOptionalString(payload.featureAudience, 250);
  const featureRequestedChange = readOptionalString(payload.featureRequestedChange, 7000);

  const priority = normalizePriority(payload.priority);
  const importance = normalizeImportance(payload.importance);

  const context = payload.context ?? {};
  const pageUrl = readOptionalString(context.pageUrl, 2000);
  const routePath = readOptionalString(context.routePath, 500);
  const pageTitle = readOptionalString(context.pageTitle, 300);
  const browserInfo = readOptionalString(context.browserInfo, 400);
  const deviceInfo = readOptionalString(context.deviceInfo, 400);
  const appVersion = readOptionalString(context.appVersion, 120);
  const environment = readOptionalString(context.environment, 120);

  if (!pageUrl) {
    throw new Error("Page URL is required.");
  }

  if (type === "feature_request" || type === "feature_change") {
    if (!featureTitle) {
      throw new Error("Feature title is required for feature feedback.");
    }
    if (!featureProblem) {
      throw new Error("Feature problem statement is required for feature feedback.");
    }
  } else {
    if (!whatTryingToDo) {
      throw new Error("What you were trying to do is required.");
    }
    if (!whatHappened) {
      throw new Error("What happened is required.");
    }
  }

  return {
    type,
    priority: priority ?? priorityFromImportance(importance),
    importance,
    whatTryingToDo,
    whatHappened,
    expectedResult,
    extraComments,
    featureTitle,
    featureProblem,
    featureAudience,
    featureRequestedChange,
    context: {
      crmScope: normalizeCrmScope(context.crmScope),
      pageUrl,
      routePath,
      pageTitle,
      browserInfo,
      deviceInfo,
      appVersion,
      environment,
    },
  };
}

/** Increments one ticket sequence value in the WD-000000 format. */
function nextTicketNumber(previousTicketNumber: string | null): string {
  const previousMatch = previousTicketNumber ? /^WD-(\d+)$/.exec(previousTicketNumber) : null;
  const previousValue = previousMatch ? Number(previousMatch[1]) : 0;
  const nextValue = Number.isFinite(previousValue) ? previousValue + 1 : 1;
  return `WD-${String(nextValue).padStart(6, "0")}`;
}

/** Creates one ticket with retry logic to handle rare sequence collisions. */
async function createTicketWithSequence(data: Prisma.WatchdogFeedbackTicketCreateInput) {
  let attempts = 0;

  while (attempts < 5) {
    attempts += 1;

    const latest = await prisma.watchdogFeedbackTicket.findFirst({
      orderBy: { createdAt: "desc" },
      select: { ticketNumber: true },
    });

    try {
      return await prisma.watchdogFeedbackTicket.create({
        data: {
          ...data,
          ticketNumber: nextTicketNumber(latest?.ticketNumber ?? null),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a feedback ticket number.");
}

/**
 * POST /api/feedback/submit
 * Accepts end-user product feedback and creates one auditable Watchdog ticket.
 */
router.post("/submit", requireAuth, requirePermission("feedback.submit"), async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  let normalized: NormalizedFeedbackPayload;
  try {
    normalized = normalizeSubmissionPayload(req.body as FeedbackSubmitPayload);
  } catch (error) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Feedback payload is invalid.",
      },
    });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({
      error: {
        code: "ORGANIZATION_NOT_FOUND",
        message: "No organization is configured for this request.",
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const submittedByName = user ? `${user.firstName} ${user.lastName}`.trim() : null;

  const created = await createTicketWithSequence({
    organizationId,
    type: normalized.type,
    status: "new",
    priority: normalized.priority,
    crmScope: normalized.context.crmScope,
    pageUrl: normalized.context.pageUrl,
    routePath: normalized.context.routePath,
    pageTitle: normalized.context.pageTitle,
    submittedByUserId: userId,
    submittedByName,
    submittedByEmail: user?.email ?? req.user?.email ?? null,
    whatTryingToDo: normalized.whatTryingToDo,
    whatHappened: normalized.whatHappened,
    expectedResult: normalized.expectedResult,
    extraComments: normalized.extraComments,
    featureTitle: normalized.featureTitle,
    featureProblem: normalized.featureProblem,
    featureAudience: normalized.featureAudience,
    featureRequestedChange: normalized.featureRequestedChange,
    importance: normalized.importance,
    browserInfo: normalized.context.browserInfo,
    deviceInfo: normalized.context.deviceInfo,
    appVersion: normalized.context.appVersion,
    environment: normalized.context.environment,
  });

  await logAudit({
    action: "FEEDBACK_TICKET_SUBMITTED",
    entity: "WatchdogFeedbackTicket",
    entityId: created.id,
    userId,
    organizationId,
    metadata: {
      ticketNumber: created.ticketNumber,
      type: created.type,
      priority: created.priority,
      status: created.status,
      crmScope: created.crmScope,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: securitySeverityFromPriority(created.priority as (typeof PRIORITIES)[number]),
      eventType: "WATCHDOG_FEEDBACK_TICKET_SUBMITTED",
      sourceModule: "watchdog",
      message: `Feedback ticket ${created.ticketNumber} submitted`,
      payload: {
        ticketId: created.id,
        ticketNumber: created.ticketNumber,
        type: created.type,
        priority: created.priority,
        crmScope: created.crmScope,
        submittedByUserId: userId,
      },
    });
  } catch {
    // No-op: submission should still succeed when the external Watchdog event store is unavailable.
  }

  res.status(201).json({
    ticket: {
      id: created.id,
      ticketNumber: created.ticketNumber,
      status: created.status,
      priority: created.priority,
      type: created.type,
      crmScope: created.crmScope,
      createdAt: created.createdAt,
    },
  });
});

/**
 * GET /api/feedback/my
 * Returns one user's own feedback tickets for quick self-service follow-up.
 */
router.get("/my", requireAuth, requirePermission("feedback.view_own"), async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({
      error: {
        code: "ORGANIZATION_NOT_FOUND",
        message: "No organization is configured for this request.",
      },
    });
    return;
  }

  const items = await prisma.watchdogFeedbackTicket.findMany({
    where: {
      organizationId,
      submittedByUserId: userId,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: MY_TICKET_SELECT,
  });

  res.json({ items });
});

/** Exposes feedback submission routes for all authenticated CRM users. */
export default router;
