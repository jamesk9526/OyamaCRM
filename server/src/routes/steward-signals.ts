/**
 * Steward Signals API routes.
 *
 * Provides read APIs for summary, opportunity queue, lapse cohorts, and donor profile widgets,
 * plus confirm-first action endpoints for opportunity-driven task/email/dismiss workflows.
 *
 * Routes:
 *   GET  /api/steward-signals/summary
 *   GET  /api/steward-signals/opportunities
 *   GET  /api/steward-signals/lapse-radar
 *   GET  /api/steward-signals/donors/:id/widget
 *   POST /api/steward-signals/opportunities/:id/create-task
 *   POST /api/steward-signals/opportunities/:id/draft-email
 *   POST /api/steward-signals/opportunities/:id/dismiss
 *
 * @module routes/steward-signals
 */
import { Router } from "express";
import type { DonorStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

// All Steward Signals endpoints require authentication.
router.use(requireAuth);

type OpportunityPriority = "High" | "Medium" | "Low";
type OpportunityStatus = "Needs Review" | "Queued";

interface OpportunityRecord {
  id: string;
  constituentId: string;
  donorName: string;
  priority: OpportunityPriority;
  opportunityType: string;
  reason: string;
  suggestedAction: string;
  channel: string;
  dueDateIso: string;
  ownerName: string;
  status: OpportunityStatus;
  confidence: number;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface StewardWidgetResponse {
  constituentId: string;
  donorName: string;
  generosityScore: number;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  bestNextStep: string;
  bestChannel: string;
  confidence: number;
  explanation: string;
  lastGiftDate: string | null;
  lastGiftAmount: number;
  totalLifetimeGiving: number;
  giftCount: number;
  inDevelopmentNote: string;
}

/** Returns days elapsed since a gift date; large sentinel value when missing. */
function daysSince(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** Best-effort conversion from unknown to number. */
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Best-effort conversion from unknown to string. */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Loads steward custom field IDs for score/value retrieval when configured. */
async function loadStewardFieldIds(organizationId: string): Promise<Record<string, string>> {
  const fields = await prisma.customField.findMany({
    where: {
      organizationId,
      entityType: "constituent",
      key: {
        in: [
          "demoStewardGenerosityScore",
          "demoStewardLapseRisk",
          "demoStewardOpportunityScore",
          "demoStewardOpportunityRecommendation",
        ],
      },
    },
    select: { id: true, key: true },
  });

  return Object.fromEntries(fields.map((field) => [field.key, field.id]));
}

/** Loads custom signal values for a list of constituents when fields are present. */
async function loadSignalValues(
  constituentIds: string[],
  fieldIds: Record<string, string>
): Promise<Map<string, Record<string, string>>> {
  const uniqueFieldIds = Object.values(fieldIds);
  if (constituentIds.length === 0 || uniqueFieldIds.length === 0) {
    return new Map<string, Record<string, string>>();
  }

  const storedValues = await prisma.customFieldValue.findMany({
    where: {
      entityType: "constituent",
      entityId: { in: constituentIds },
      fieldId: { in: uniqueFieldIds },
    },
    select: {
      entityId: true,
      fieldId: true,
      value: true,
    },
  });

  const byConstituent = new Map<string, Record<string, string>>();

  for (const value of storedValues) {
    const entry = byConstituent.get(value.entityId) ?? {};
    const fieldKey = Object.entries(fieldIds).find((pair) => pair[1] === value.fieldId)?.[0];
    if (!fieldKey) continue;

    let normalized = "";
    if (value.value !== null && value.value !== undefined) {
      try {
        normalized = String(JSON.parse(value.value));
      } catch {
        normalized = String(value.value);
      }
    }

    entry[fieldKey] = normalized;
    byConstituent.set(value.entityId, entry);
  }

  return byConstituent;
}

/** Derives lapse risk with custom-field override and deterministic fallback rules. */
function deriveLapseRisk(
  donorStatus: DonorStatus,
  lastGiftDate: Date | null,
  customLapseRisk?: string
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const custom = customLapseRisk?.toUpperCase();
  if (custom === "LOW" || custom === "MEDIUM" || custom === "HIGH" || custom === "CRITICAL") {
    return custom;
  }

  const elapsed = daysSince(lastGiftDate);
  if (donorStatus === "LAPSED" || elapsed > 730) return "CRITICAL";
  if (elapsed > 365) return "HIGH";
  if (elapsed > 180) return "MEDIUM";
  return "LOW";
}

/** Derives opportunity score with custom-field override and behavior fallback rules. */
function deriveOpportunityScore(params: {
  customOpportunityScore?: string;
  donorStatus: DonorStatus;
  giftCount: number;
  engagementScore: number;
  lastGiftAmount: Prisma.Decimal | number | null;
  lastGiftDate: Date | null;
}): number {
  const custom = asNumber(params.customOpportunityScore, Number.NaN);
  if (Number.isFinite(custom)) return Math.max(0, Math.min(100, Math.round(custom)));

  let score = params.engagementScore;
  if (params.donorStatus === "MAJOR_DONOR") score += 14;
  if (params.giftCount >= 4) score += 8;
  if (asNumber(params.lastGiftAmount, 0) >= 5000) score += 10;

  const elapsed = daysSince(params.lastGiftDate);
  if (elapsed <= 45) score += 8;
  if (elapsed > 365) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Derives generosity score with custom-field override and giving-history fallback rules. */
function deriveGenerosityScore(params: {
  customGenerosityScore?: string;
  donorStatus: DonorStatus;
  totalLifetimeGiving: Prisma.Decimal | number;
  giftCount: number;
  engagementScore: number;
}): number {
  const custom = asNumber(params.customGenerosityScore, Number.NaN);
  if (Number.isFinite(custom)) return Math.max(0, Math.min(100, Math.round(custom)));

  let score = Math.round(params.engagementScore * 0.55);
  score += Math.min(20, Math.floor(params.giftCount / 2));
  score += Math.min(20, Math.floor(asNumber(params.totalLifetimeGiving, 0) / 5000));
  if (params.donorStatus === "MAJOR_DONOR") score += 8;
  if (params.donorStatus === "LAPSED") score -= 14;

  return Math.max(0, Math.min(100, score));
}

/** Builds stable opportunity IDs that action endpoints can parse deterministically. */
function buildOpportunityId(kind: string, constituentId: string): string {
  return `${kind}__${constituentId}`;
}

/** Parses opportunity IDs from route params. */
function parseOpportunityId(rawId: string): { kind: string; constituentId: string } | null {
  const [kind, constituentId] = rawId.split("__");
  if (!kind || !constituentId) return null;
  return { kind, constituentId };
}

/**
 * Creates opportunity queue records from current constituent + task + signal context.
 * This logic is intentionally explainable and deterministic while model-based scoring evolves.
 */
function buildOpportunities(params: {
  constituents: Array<{
    id: string;
    firstName: string;
    lastName: string;
    donorStatus: DonorStatus;
    giftCount: number;
    lastGiftDate: Date | null;
    lastGiftAmount: Prisma.Decimal | null;
    engagementScore: number;
    doNotEmail: boolean;
    doNotCall: boolean;
    doNotMail: boolean;
  }>;
  openTasksByConstituent: Map<string, number>;
  signalValuesByConstituent: Map<string, Record<string, string>>;
  dismissedOpportunityIds: Set<string>;
}): OpportunityRecord[] {
  const output: OpportunityRecord[] = [];

  for (const constituent of params.constituents) {
    const donorName = `${constituent.firstName} ${constituent.lastName}`;
    const signal = params.signalValuesByConstituent.get(constituent.id) ?? {};
    const lapseRisk = deriveLapseRisk(constituent.donorStatus, constituent.lastGiftDate, signal.demoStewardLapseRisk);
    const opportunityScore = deriveOpportunityScore({
      customOpportunityScore: signal.demoStewardOpportunityScore,
      donorStatus: constituent.donorStatus,
      giftCount: constituent.giftCount,
      engagementScore: constituent.engagementScore,
      lastGiftAmount: constituent.lastGiftAmount,
      lastGiftDate: constituent.lastGiftDate,
    });

    const hasOpenTasks = (params.openTasksByConstituent.get(constituent.id) ?? 0) > 0;
    const daysFromGift = daysSince(constituent.lastGiftDate);
    const preferredChannel = constituent.doNotEmail
      ? (constituent.doNotCall ? "Mail" : "Phone")
      : "Email";

    // New donor second-gift follow-up.
    if (constituent.giftCount === 1 && daysFromGift >= 14 && daysFromGift <= 65) {
      const id = buildOpportunityId("second-gift", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: "High",
          opportunityType: "Second Gift Invitation",
          reason: `First gift was ${daysFromGift} days ago and second-gift follow-up is due.`,
          suggestedAction: "Create personal follow-up task and draft thank-you + invitation email.",
          channel: preferredChannel,
          dueDateIso: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: Math.max(62, Math.min(95, opportunityScore)),
          opportunityScore,
          lapseRisk,
        });
      }
    }

    // Lapse / cadence broken follow-up.
    if (lapseRisk === "HIGH" || lapseRisk === "CRITICAL" || daysFromGift > 180) {
      const id = buildOpportunityId("lapse-follow-up", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: lapseRisk === "CRITICAL" ? "High" : "Medium",
          opportunityType: lapseRisk === "CRITICAL" ? "Lapsed Donor Reconnect" : "Cadence Broken Follow-Up",
          reason: `Lapse risk is ${lapseRisk}; last completed gift was ${daysFromGift} days ago.`,
          suggestedAction: "Create reconnect outreach task and draft a stewardship follow-up message.",
          channel: constituent.doNotCall ? "Mail" : "Phone",
          dueDateIso: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: Math.max(58, Math.min(93, opportunityScore - 4)),
          opportunityScore,
          lapseRisk,
        });
      }
    }

    // Major gift stewardship follow-up.
    if (constituent.donorStatus === "MAJOR_DONOR" || asNumber(constituent.lastGiftAmount, 0) >= 5000) {
      const id = buildOpportunityId("major-stewardship", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: "High",
          opportunityType: "Major Gift Stewardship",
          reason: "Major-gift signals are present and proactive stewardship is recommended.",
          suggestedAction: "Create personalized stewardship task and draft impact-update email.",
          channel: constituent.doNotEmail ? "Phone" : "Email then phone",
          dueDateIso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: Math.max(68, Math.min(98, opportunityScore + 5)),
          opportunityScore,
          lapseRisk,
        });
      }
    }
  }

  const priorityRank: Record<OpportunityPriority, number> = { High: 3, Medium: 2, Low: 1 };

  return output
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      return b.opportunityScore - a.opportunityScore;
    });
}

/** Loads queue primitives used by summary, opportunities, and lapse-radar endpoints. */
async function loadOpportunityContext(organizationId: string, userId?: string): Promise<OpportunityRecord[]> {
  const [constituents, openTasks, fieldIds] = await Promise.all([
    prisma.constituent.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        donorStatus: true,
        giftCount: true,
        lastGiftDate: true,
        lastGiftAmount: true,
        engagementScore: true,
        doNotEmail: true,
        doNotCall: true,
        doNotMail: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 750,
    }),
    prisma.task.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        constituent: { organizationId },
      },
      select: {
        constituentId: true,
      },
      take: 2500,
    }),
    loadStewardFieldIds(organizationId),
  ]);

  const openTasksByConstituent = new Map<string, number>();
  for (const task of openTasks) {
    if (!task.constituentId) continue;
    const count = openTasksByConstituent.get(task.constituentId) ?? 0;
    openTasksByConstituent.set(task.constituentId, count + 1);
  }

  const signalValuesByConstituent = await loadSignalValues(constituents.map((c) => c.id), fieldIds);

  const dismissedLogs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_OPPORTUNITY_DISMISSED",
      ...(userId ? { userId } : {}),
    },
    select: { entityId: true },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });

  const dismissedOpportunityIds = new Set(
    dismissedLogs.map((log) => log.entityId).filter((id): id is string => Boolean(id))
  );

  return buildOpportunities({
    constituents,
    openTasksByConstituent,
    signalValuesByConstituent,
    dismissedOpportunityIds,
  });
}

/**
 * GET /api/steward-signals/summary
 * Returns dashboard summary cards:
 * { highOpportunityDonors, atRiskCadenceBroken, monthlyGivingCandidates, thankYousNeeded, updatedAt }
 */
router.get("/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      highOpportunityDonors: 0,
      atRiskCadenceBroken: 0,
      monthlyGivingCandidates: 0,
      thankYousNeeded: 0,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const [opportunities, recentDonations, pendingThankYous] = await Promise.all([
    loadOpportunityContext(organizationId, req.user?.sub),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: {
        constituentId: true,
        isRecurring: true,
      },
      take: 12000,
    }),
    prisma.task.count({
      where: {
        constituent: { organizationId },
        type: "THANK_YOU",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  const donationCountByConstituent = new Map<string, { total: number; recurring: number }>();
  for (const donation of recentDonations) {
    const entry = donationCountByConstituent.get(donation.constituentId) ?? { total: 0, recurring: 0 };
    entry.total += 1;
    if (donation.isRecurring) entry.recurring += 1;
    donationCountByConstituent.set(donation.constituentId, entry);
  }

  const monthlyGivingCandidates = Array.from(donationCountByConstituent.values()).filter(
    (entry) => entry.total >= 3 && entry.recurring === 0
  ).length;

  const highOpportunityDonors = opportunities.filter((opp) => opp.opportunityScore >= 78).length;
  const atRiskCadenceBroken = opportunities.filter((opp) => opp.lapseRisk === "HIGH" || opp.lapseRisk === "CRITICAL").length;

  res.json({
    highOpportunityDonors,
    atRiskCadenceBroken,
    monthlyGivingCandidates,
    thankYousNeeded: pendingThankYous,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/steward-signals/opportunities?limit=50
 * Returns explainable opportunity queue records for action review.
 */
router.get("/opportunities", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 250) : 50;

  const opportunities = await loadOpportunityContext(organizationId, req.user?.sub);

  res.json(opportunities.slice(0, limit));
});

/**
 * GET /api/steward-signals/lapse-radar
 * Returns lapse cohort counts and top at-risk sample records.
 */
router.get("/lapse-radar", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      cohorts: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      sample: [],
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const opportunities = await loadOpportunityContext(organizationId, req.user?.sub);
  const byDonor = new Map<string, OpportunityRecord>();

  for (const record of opportunities) {
    const existing = byDonor.get(record.constituentId);
    if (!existing || record.opportunityScore > existing.opportunityScore) {
      byDonor.set(record.constituentId, record);
    }
  }

  const unique = Array.from(byDonor.values());

  const cohorts = {
    low: unique.filter((item) => item.lapseRisk === "LOW").length,
    medium: unique.filter((item) => item.lapseRisk === "MEDIUM").length,
    high: unique.filter((item) => item.lapseRisk === "HIGH").length,
    critical: unique.filter((item) => item.lapseRisk === "CRITICAL").length,
  };

  const sample = unique
    .filter((item) => item.lapseRisk === "HIGH" || item.lapseRisk === "CRITICAL")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 12)
    .map((item) => ({
      constituentId: item.constituentId,
      donorName: item.donorName,
      lapseRisk: item.lapseRisk,
      reason: item.reason,
      recommendedAction: item.suggestedAction,
    }));

  res.json({
    cohorts,
    sample,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/steward-signals/donors/:id/widget
 * Returns donor-profile widget data for Steward Signals:
 * { generosityScore, lapseRisk, opportunityScore, bestNextStep, bestChannel, confidence, explanation, ... }
 */
router.get("/donors/:id/widget", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const constituentId = req.params.id as string;

  const constituent = await prisma.constituent.findFirst({
    where: {
      id: constituentId,
      organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      giftCount: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      engagementScore: true,
      doNotEmail: true,
      doNotCall: true,
    },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found." } });
    return;
  }

  const fieldIds = await loadStewardFieldIds(organizationId);
  const signalValues = await loadSignalValues([constituent.id], fieldIds);
  const signal = signalValues.get(constituent.id) ?? {};

  const generosityScore = deriveGenerosityScore({
    customGenerosityScore: signal.demoStewardGenerosityScore,
    donorStatus: constituent.donorStatus,
    totalLifetimeGiving: constituent.totalLifetimeGiving,
    giftCount: constituent.giftCount,
    engagementScore: constituent.engagementScore,
  });

  const opportunityScore = deriveOpportunityScore({
    customOpportunityScore: signal.demoStewardOpportunityScore,
    donorStatus: constituent.donorStatus,
    giftCount: constituent.giftCount,
    engagementScore: constituent.engagementScore,
    lastGiftAmount: constituent.lastGiftAmount,
    lastGiftDate: constituent.lastGiftDate,
  });

  const lapseRisk = deriveLapseRisk(constituent.donorStatus, constituent.lastGiftDate, signal.demoStewardLapseRisk);

  const bestChannel = constituent.doNotEmail ? (constituent.doNotCall ? "Mail" : "Phone") : "Email";
  const bestNextStep = asString(
    signal.demoStewardOpportunityRecommendation,
    lapseRisk === "CRITICAL"
      ? "Create reconnect task and schedule personal outreach."
      : constituent.giftCount <= 1
        ? "Draft second-gift invitation with impact context."
        : "Assign stewardship check-in task and prepare donor update."
  );

  const response: StewardWidgetResponse = {
    constituentId: constituent.id,
    donorName: `${constituent.firstName} ${constituent.lastName}`,
    generosityScore,
    opportunityScore,
    lapseRisk,
    bestNextStep,
    bestChannel,
    confidence: Math.max(55, Math.min(98, Math.round((generosityScore + opportunityScore) / 2))),
    explanation: `Signals combine giving recency, frequency, donor status, and stewardship activity context.`,
    lastGiftDate: constituent.lastGiftDate ? constituent.lastGiftDate.toISOString() : null,
    lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
    totalLifetimeGiving: asNumber(constituent.totalLifetimeGiving, 0),
    giftCount: constituent.giftCount,
    inDevelopmentNote: "Widget is read-only while full score recalculation APIs are finalized.",
  };

  res.json(response);
});

/**
 * POST /api/steward-signals/opportunities/:id/create-task
 * Confirm-first action endpoint.
 * Body: { confirm: true, assigneeId?: string, dueDate?: string }
 */
router.post("/opportunities/:id/create-task", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: parsed.constituentId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found for opportunity." } });
    return;
  }

  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const assigneeId = asString(req.body?.assigneeId, req.user?.sub ?? "") || undefined;

  const task = await prisma.task.create({
    data: {
      constituentId: constituent.id,
      assigneeId,
      createdById: req.user?.sub,
      title: `${constituent.firstName} ${constituent.lastName}: Steward opportunity follow-up`,
      description: `Opportunity ${parsed.kind} triggered from Steward Signals. ${req.body?.note ? String(req.body.note) : ""}`.trim(),
      type: parsed.kind === "second-gift" ? "THANK_YOU" : "FOLLOW_UP",
      status: "PENDING",
      priority: parsed.kind === "major-stewardship" ? "HIGH" : "MEDIUM",
      dueDate,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      priority: true,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      taskId: task.id,
      userId: req.user?.sub,
      type: "NOTE",
      description: `Steward Signals created task from opportunity ${parsed.kind}.`,
      metadata: {
        source: "api/steward-signals/opportunities/create-task",
        opportunityId: req.params.id,
      },
    },
  });

  await logAudit({
    action: "STEWARD_OPPORTUNITY_TASK_CREATED",
    entity: "Task",
    entityId: task.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      opportunityId: req.params.id,
      constituentId: constituent.id,
      kind: parsed.kind,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    success: true,
    task,
    message: "Task created from opportunity with explicit confirmation.",
  });
});

/**
 * POST /api/steward-signals/opportunities/:id/draft-email
 * Confirm-first action endpoint.
 * Body: { confirm: true }
 */
router.post("/opportunities/:id/draft-email", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: parsed.constituentId, organizationId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found for opportunity." } });
    return;
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Steward Draft: ${constituent.firstName} ${constituent.lastName}`,
      subject: `Thank you for your continued partnership`,
      previewText: `Steward Signals generated a draft for review before sending.`,
      fromName: "OyamaCRM Steward",
      fromEmail: "noreply@oyamacrm.org",
      replyToEmail: "support@oyamacrm.org",
      bodyHtml: `<p>Dear ${constituent.firstName},</p><p>Thank you for your support. This draft was generated from Steward Signals and requires staff review before sending.</p>`,
      bodyText: `Dear ${constituent.firstName},\n\nThank you for your support. This draft was generated from Steward Signals and requires staff review before sending.`,
      audienceFilter: JSON.stringify({ constituentIds: [constituent.id], source: "steward-signals" }),
      status: "DRAFT",
    },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      updatedAt: true,
    },
  });

  await logAudit({
    action: "STEWARD_OPPORTUNITY_EMAIL_DRAFTED",
    entity: "EmailCampaign",
    entityId: campaign.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      opportunityId: req.params.id,
      constituentId: constituent.id,
      kind: parsed.kind,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    success: true,
    draft: campaign,
    message: "Email draft created from opportunity with explicit confirmation.",
  });
});

/**
 * POST /api/steward-signals/opportunities/:id/dismiss
 * Confirm-first action endpoint.
 * Body: { confirm: true, reason?: string }
 */
router.post("/opportunities/:id/dismiss", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  await logAudit({
    action: "STEWARD_OPPORTUNITY_DISMISSED",
    entity: "Opportunity",
    entityId: req.params.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      kind: parsed.kind,
      constituentId: parsed.constituentId,
      reason: asString(req.body?.reason, "No reason supplied"),
      source: "api/steward-signals/opportunities/dismiss",
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    success: true,
    dismissed: true,
    opportunityId: req.params.id,
  });
});

export default router;
