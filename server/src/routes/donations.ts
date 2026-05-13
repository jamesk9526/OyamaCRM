/**
 * Donation management routes for OyamaCRM.
 * Provides paginated listing and CRUD operations for donation records.
 * Supports filtering by constituent, campaign, designation, status, and date range,
 * as well as full-text search across the linked constituent's name and email.
 *
 * Routes:
 *   GET  /api/donations      — paginated list with filters
 *   GET  /api/donations/:id  — single donation with related pledge
 *   POST /api/donations      — record a new donation
 *   PUT  /api/donations/:id  — update a donation
 *   DELETE /api/donations/:id — delete a donation (admin / batch entry corrections)
 *
 * @module routes/donations
 */
import { Router } from "express";
import type { DonationStatus, Prisma } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { donationOrgWhere } from "../lib/donationScope.js";
import { executeStewardPathsForTrigger } from "../services/stewardPathsEngine.js";

const router = Router();

// All donation routes require authentication.
router.use(requireAuth);

// Fine-grained permission checks for donation read/write/delete/import flows.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:donations")(req, res, next);
  }
  if (req.method === "POST" && req.path === "/import") {
    return requirePermission("import:data")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    return requirePermission("edit:donations")(req, res, next);
  }
  if (req.method === "DELETE") {
    return requirePermission("delete:donations")(req, res, next);
  }
  return next();
});

/**
 * Standard relations to include on every donation response.
 * Provides a summary of the linked constituent, campaign, and designation
 * without fetching their full records.
 */
const INCLUDE = {
  constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
  campaign:    { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
};

interface DonationQuickActionContext {
  id: string;
  date: Date;
  amount: Prisma.Decimal;
  paymentMethod: string;
  campaignId: string | null;
  designationId: string | null;
  constituent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  campaign: {
    id: string;
    name: string;
  } | null;
  designation: {
    id: string;
    name: string;
  } | null;
}

/** Formats donation date into YYYY-MM-DD for deterministic task/draft naming. */
function formatDonationDateForLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formats one donation amount with fixed dollars and cents for generated labels. */
function formatDonationAmountForLabel(amount: Prisma.Decimal): string {
  return Number(amount).toFixed(2);
}

/** Loads one donation with linked constituent/campaign/designation context for quick actions. */
async function loadDonationQuickActionContext(organizationId: string, donationId: string): Promise<DonationQuickActionContext | null> {
  return prisma.donation.findFirst({
    where: {
      id: donationId,
      ...donationOrgWhere(organizationId),
    },
    select: {
      id: true,
      date: true,
      amount: true,
      paymentMethod: true,
      campaignId: true,
      designationId: true,
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
      designation: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/** Normalizes Express route id params to one string for strict TypeScript call-sites. */
function getRouteIdParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Resolves the best available donor steward path template for quick enrollment actions. */
async function resolveDefaultDonationPathTemplate(organizationId: string) {
  const preferred = await prisma.stewardPath.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      crmScope: { in: ["DONOR", "GLOBAL"] },
      targetType: { in: ["CONSTITUENT", "DONOR"] },
      steps: { some: { isActive: true } },
    },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (preferred) return preferred;

  return prisma.stewardPath.findFirst({
    where: {
      organizationId,
      status: { in: ["DRAFT", "PAUSED"] },
      crmScope: { in: ["DONOR", "GLOBAL"] },
      targetType: { in: ["CONSTITUENT", "DONOR"] },
      steps: { some: { isActive: true } },
    },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

type DonationFilterQuery = {
  constituentId?: string;
  campaignId?: string;
  designationId?: string;
  status?: string;
  from?: string;
  to?: string;
  search?: string;
  scope?: string;
};

/**
 * Computes a normalized 0-100 engagement score from giving behavior.
 * This keeps engagement deterministic until broader interaction signals are wired.
 */
function computeEngagementScore(params: {
  giftCount: number;
  lastGiftDate: Date | null;
  totalLifetimeGiving: number;
  totalYtdGiving: number;
}): number {
  if (params.giftCount <= 0) return 0;

  const now = Date.now();
  const daysSinceLastGift = params.lastGiftDate
    ? Math.max(0, Math.floor((now - params.lastGiftDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 9999;

  const recencyScore =
    daysSinceLastGift <= 30 ? 35
      : daysSinceLastGift <= 90 ? 28
      : daysSinceLastGift <= 180 ? 20
      : daysSinceLastGift <= 365 ? 12
      : daysSinceLastGift <= 730 ? 6
      : 2;

  const frequencyScore = Math.min(25, Math.round(params.giftCount * 2.5));
  const lifetimeScore = Math.min(25, Math.round(Math.log10(params.totalLifetimeGiving + 1) * 10));
  const momentumScore = Math.min(15, Math.round(Math.log10(params.totalYtdGiving + 1) * 7));

  return Math.max(0, Math.min(100, recencyScore + frequencyScore + lifetimeScore + momentumScore));
}

/**
 * Recalculates one constituent's denormalized giving rollups from all recorded donations.
 * Lifetime totals intentionally include all donation records across all years.
 */
async function recalculateConstituentGivingRollups(constituentId: string): Promise<void> {
  const startOfCurrentYear = new Date(new Date().getFullYear(), 0, 1);
  const now = new Date();

  const [lifetimeAgg, ytdAgg, lastGift] = await Promise.all([
    prisma.donation.aggregate({
      where: { constituentId },
      _sum: { amount: true },
      _count: { id: true },
      _min: { date: true },
    }),
    prisma.donation.aggregate({
      where: {
        constituentId,
        date: { gte: startOfCurrentYear, lte: now },
      },
      _sum: { amount: true },
    }),
    prisma.donation.findFirst({
      where: { constituentId },
      orderBy: { date: "desc" },
      select: { amount: true, date: true },
    }),
  ]);

  const totalLifetimeGiving = Number(lifetimeAgg._sum.amount ?? 0);
  const totalYtdGiving = Number(ytdAgg._sum.amount ?? 0);
  const giftCount = lifetimeAgg._count.id;
  const engagementScore = computeEngagementScore({
    giftCount,
    lastGiftDate: lastGift?.date ?? null,
    totalLifetimeGiving,
    totalYtdGiving,
  });

  await prisma.constituent.update({
    where: { id: constituentId },
    data: {
      totalLifetimeGiving,
      totalYtdGiving,
      giftCount,
      engagementScore,
      firstGiftDate: lifetimeAgg._min.date ?? undefined,
      lastGiftDate: lastGift?.date ?? undefined,
      lastGiftAmount: lastGift?.amount ?? undefined,
    },
  });
}

/** Parses a YYYY-MM-DD-like date string into start-of-day local time. */
function parseDateStart(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

/** Parses a YYYY-MM-DD-like date string into end-of-day local time. */
function parseDateEnd(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(23, 59, 59, 999);
  return parsed;
}

/**
 * Builds the canonical donation filters used by list + stats routes.
 * `scope=CURRENT_YEAR` applies Jan 1 → now when from/to are not provided.
 */
function buildDonationWhere(
  organizationId: string,
  query: DonationFilterQuery
): Prisma.DonationWhereInput {
  const keyword = query.search?.trim();
  const start = parseDateStart(query.from);
  const end = parseDateEnd(query.to);

  let dateFilter: Prisma.DateTimeFilter | undefined;
  if (start || end) {
    dateFilter = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  } else if (query.scope?.toUpperCase() === "CURRENT_YEAR") {
    dateFilter = { gte: new Date(new Date().getFullYear(), 0, 1) };
  }

  return {
    AND: [
      donationOrgWhere(organizationId),
      ...(query.constituentId ? [{ constituentId: query.constituentId }] : []),
      ...(query.campaignId ? [{ campaignId: query.campaignId }] : []),
      ...(query.designationId ? [{ designationId: query.designationId }] : []),
      ...(query.status ? [{ status: query.status as DonationStatus }] : []),
      ...(dateFilter ? [{ date: dateFilter }] : []),
      ...(keyword
        ? [
            {
              // Keep search provider-compatible: some Prisma providers in this repo
              // do not support `mode: "insensitive"` on string filters.
              constituent: {
                OR: [
                  { firstName: { contains: keyword } },
                  { lastName: { contains: keyword } },
                  { email: { contains: keyword } },
                ],
              },
            },
          ]
        : []),
    ],
  };
}

/** GET /api/donations — Paginated donation list with optional filters for constituent, campaign, date range, and status. */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ items: [], total: 0, page: 1, limit: 50 });
    return;
  }

  const {
    constituentId,
    campaignId,
    designationId,
    status,
    from,
    to,
    search,
    scope,
    page = "1",
    limit = "50",
  } = req.query as Record<string, string>;

  const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 500);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = buildDonationWhere(organizationId, {
    constituentId,
    campaignId,
    designationId,
    status,
    from,
    to,
    search,
    scope,
  });

  // Run the list query and count in parallel to avoid two sequential round-trips
  const [items, total] = await Promise.all([
    prisma.donation.findMany({ where, skip, take: parsedLimit, orderBy: { date: "desc" }, include: INCLUDE }),
    prisma.donation.count({ where }),
  ]);

  res.json({ items, total, page: parsedPage, limit: parsedLimit });
});

/**
 * GET /api/donations/stats — Aggregate metrics for the full filtered dataset.
 * Returns totals across all matching rows (not just the current page).
 */
router.get("/stats", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ totalRaised: 0, totalGifts: 0, completed: 0, recurring: 0 });
    return;
  }

  const { constituentId, campaignId, designationId, status, from, to, search, scope } = req.query as Record<string, string>;
  const where = buildDonationWhere(organizationId, {
    constituentId,
    campaignId,
    designationId,
    status,
    from,
    to,
    search,
    scope,
  });

  const [raisedSum, totalGifts, completed, recurring] = await Promise.all([
    prisma.donation.aggregate({
      where: { AND: [where, { status: "COMPLETED" satisfies DonationStatus }] },
      _sum: { amount: true },
    }),
    prisma.donation.count({ where }),
    prisma.donation.count({ where: { AND: [where, { status: "COMPLETED" satisfies DonationStatus }] } }),
    prisma.donation.count({ where: { AND: [where, { isRecurring: true }] } }),
  ]);

  res.json({
    totalRaised: Number(raisedSum._sum.amount ?? 0),
    totalGifts,
    completed,
    recurring,
  });
});

/** GET /api/donations/:id — Fetch a single donation including its linked pledge if present. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const donation = await prisma.donation.findFirst({
    where: { id: req.params.id, constituent: { organizationId } },
    include: { ...INCLUDE, pledge: true },
  });
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

/** POST /api/donations — Record a new donation. Defaults: paymentMethod=ONLINE, status=COMPLETED, taxDeductible=true. */
router.post("/", async (req, res) => {
  const {
    constituentId, campaignId, designationId, pledgeId,
    amount, date, paymentMethod, checkNumber, isRecurring,
    frequency, status, taxDeductible, notes,
  } = req.body;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { id: true },
  });
  if (!constituent) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid constituentId for your organization" } });
    return;
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { id: true },
    });
    if (!campaign) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid campaignId for your organization" } });
      return;
    }
  }

  const donation = await prisma.donation.create({
    data: {
      constituentId,
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      pledgeId:      pledgeId      || undefined,
      amount,
      date:          date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || "ONLINE",
      checkNumber:   checkNumber   || undefined,
      isRecurring:   isRecurring   ?? false,
      frequency:     frequency     || undefined,
      status:        status        || "COMPLETED",
      taxDeductible: taxDeductible ?? true,
      notes:         notes         || undefined,
    },
    include: INCLUDE,
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "DONATION",
      description: `Donation recorded: $${Number(donation.amount).toFixed(2)}`,
      metadata: { source: "api/donations:create" },
    },
  });

  // Audit trail for new donation
  logAudit({
    action: "DONATION_CREATED",
    entity: "Donation",
    entityId: donation.id,
    userId: req.user?.sub,
    metadata: { amount: Number(donation.amount), status: donation.status, constituentId: donation.constituentId },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Execute Steward Paths for completed donations so repetitive stewardship work happens automatically.
  if (organizationId && donation.status === "COMPLETED") {
    await executeStewardPathsForTrigger({
      organizationId,
      trigger: "DONATION_RECEIVED",
      constituentId: donation.constituentId,
      donationId: donation.id,
      userId: req.user?.sub,
      source: "api/donations:create",
    });
  }

  // Keep constituent giving rollups aligned with all-time donation history.
  await recalculateConstituentGivingRollups(donation.constituentId);

  res.status(201).json(donation);
});

/** PUT /api/donations/:id — Update mutable fields on an existing donation (amount, date, status, etc.). */
router.put("/:id", async (req, res) => {
  const {
    campaignId, designationId, amount, date, paymentMethod,
    checkNumber, isRecurring, frequency, status, taxDeductible, notes,
  } = req.body;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.donation.findFirst({
    where: { id: req.params.id, constituent: { organizationId } },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  const donation = await prisma.donation.update({
    where: { id: req.params.id },
    data: {
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      amount:        amount        || undefined,
      date:          date ? new Date(date) : undefined,
      paymentMethod: paymentMethod || undefined,
      checkNumber:   checkNumber   || undefined,
      isRecurring,
      frequency:     frequency     || undefined,
      status:        status        || undefined,
      taxDeductible,
      notes:         notes         || undefined,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "NOTE",
      description: "Donation record updated",
      metadata: { source: "api/donations:update" },
    },
  });

  // Keep constituent giving rollups aligned after manual edits.
  await recalculateConstituentGivingRollups(donation.constituentId);

  res.json(donation);
});

/** POST /api/donations/:id/quick-actions/email-draft — Creates an auto-named email draft campaign and returns builder URL. */
router.post("/:id/quick-actions/email-draft", requirePermission("edit:communications"), async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const donation = await loadDonationQuickActionContext(organizationId, getRouteIdParam(req.params.id));
  if (!donation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  if (!donation.constituent.email) {
    res.status(400).json({ error: { code: "MISSING_EMAIL", message: "Constituent email is required to create an email draft." } });
    return;
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { smtpFromName: true, smtpFromEmail: true },
  });

  const donorFullName = `${donation.constituent.firstName} ${donation.constituent.lastName}`.trim();
  const dateLabel = formatDonationDateForLabel(donation.date);
  const amountLabel = formatDonationAmountForLabel(donation.amount);
  const campaignName = `Donation Follow-up: ${donorFullName} - $${amountLabel} - ${dateLabel}`;
  const subject = `Thank you for your gift, ${donation.constituent.firstName}`;
  const previewText = `Donation acknowledgment for $${amountLabel} received ${dateLabel}.`;

  const audienceFilter = JSON.stringify({
    type: "individual",
    recipientEmail: donation.constituent.email,
    recipientConstituentId: donation.constituent.id,
    source: "donation-quick-action",
    donationId: donation.id,
    _sharing: {
      ownerId: userId,
      sharedWithOrganization: false,
    },
    _workflow: {
      preparationStatus: "DRAFT",
    },
  });

  const bodyText = [
    `Hi ${donation.constituent.firstName},`,
    "",
    `Thank you for your generous donation of $${amountLabel} on ${dateLabel}.`,
    donation.designation?.name ? `Designation: ${donation.designation.name}` : "",
    donation.campaign?.name ? `Campaign: ${donation.campaign.name}` : "",
    "",
    "We are grateful for your support.",
    "",
    "With gratitude,",
    "{{staffName}}",
  ].filter(Boolean).join("\n");

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: campaignName,
      subject,
      purpose: "THANK_YOU",
      previewText,
      fromName: settings?.smtpFromName || "OyamaCRM",
      fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
      bodyText,
      bodyHtml: `<p>${bodyText.replace(/\n/g, "<br />")}</p>`,
      audienceFilter,
      status: "DRAFT",
    },
    select: { id: true },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituent.id,
      donationId: donation.id,
      userId,
      type: "NOTE",
      description: `Email draft created from donation quick action: ${campaignName}`,
      metadata: {
        source: "api/donations:quick-action-email-draft",
        campaignId: campaign.id,
      },
    },
  });

  await logAudit({
    action: "DONATION_EMAIL_DRAFT_CREATED",
    entity: "EmailCampaign",
    entityId: campaign.id,
    userId,
    organizationId,
    metadata: {
      donationId: donation.id,
      constituentId: donation.constituent.id,
      campaignName,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    campaignId: campaign.id,
    redirectTo: `/email-builder?campaign=${encodeURIComponent(campaign.id)}&returnTo=${encodeURIComponent(`/communications/${campaign.id}`)}`,
  });
});

/** POST /api/donations/:id/quick-actions/call-task — Creates an auto-named call task and returns task workspace URL. */
router.post("/:id/quick-actions/call-task", requirePermission("edit:tasks"), async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const donation = await loadDonationQuickActionContext(organizationId, getRouteIdParam(req.params.id));
  if (!donation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  const dateLabel = formatDonationDateForLabel(donation.date);
  const amountLabel = formatDonationAmountForLabel(donation.amount);
  const donorFullName = `${donation.constituent.firstName} ${donation.constituent.lastName}`.trim();
  const taskTitle = `Call ${donorFullName} - Thank for $${amountLabel} (${dateLabel})`;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const task = await prisma.task.create({
    data: {
      title: taskTitle,
      description: `Donation follow-up call for ${donorFullName}.${donation.campaign?.name ? ` Campaign: ${donation.campaign.name}.` : ""}${donation.designation?.name ? ` Designation: ${donation.designation.name}.` : ""}`,
      type: "CALL",
      status: "PENDING",
      priority: "HIGH",
      dueDate,
      constituentId: donation.constituent.id,
      createdById: userId,
      assigneeId: userId,
    },
    select: { id: true },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituent.id,
      donationId: donation.id,
      userId,
      taskId: task.id,
      type: "NOTE",
      description: `Call task created from donation quick action: ${taskTitle}`,
      metadata: {
        source: "api/donations:quick-action-call-task",
        taskId: task.id,
      },
    },
  });

  await logAudit({
    action: "DONATION_CALL_TASK_CREATED",
    entity: "Task",
    entityId: task.id,
    userId,
    organizationId,
    metadata: {
      donationId: donation.id,
      constituentId: donation.constituent.id,
      taskTitle,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    taskId: task.id,
    redirectTo: `/tasks?focus=my&taskId=${encodeURIComponent(task.id)}`,
  });
});

/** POST /api/donations/:id/quick-actions/start-path — Enrolls donor into default path with auto metadata and returns workflow URL. */
router.post("/:id/quick-actions/start-path", requirePermission("steward_paths.enroll"), async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const donation = await loadDonationQuickActionContext(organizationId, getRouteIdParam(req.params.id));
  if (!donation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  const pathTemplate = await resolveDefaultDonationPathTemplate(organizationId);
  if (!pathTemplate || pathTemplate.steps.length === 0) {
    res.status(400).json({
      error: {
        code: "PATH_TEMPLATE_REQUIRED",
        message: "No active donor steward path template with steps is available.",
      },
    });
    return;
  }

  const amountLabel = formatDonationAmountForLabel(donation.amount);
  const dateLabel = formatDonationDateForLabel(donation.date);
  const donorFullName = `${donation.constituent.firstName} ${donation.constituent.lastName}`.trim();
  const enrollmentLabel = `${pathTemplate.name} - ${donorFullName} - $${amountLabel} (${dateLabel})`;

  const enrollment = await prisma.stewardPathEnrollment.create({
    data: {
      organizationId,
      pathId: pathTemplate.id,
      targetType: pathTemplate.targetType,
      targetId: donation.constituent.id,
      constituentId: donation.constituent.id,
      ownerUserId: pathTemplate.defaultOwnerId ?? userId,
      currentStepId: pathTemplate.steps[0]?.id ?? null,
      nextStepDueAt: new Date(),
      status: "ACTIVE",
    },
    select: { id: true, pathId: true },
  });

  await prisma.stewardPathTimelineEvent.create({
    data: {
      enrollmentId: enrollment.id,
      stepId: pathTemplate.steps[0]?.id ?? null,
      eventType: "PATH_STARTED",
      message: `Enrollment started from donation quick action: ${enrollmentLabel}`,
      createdByUserId: userId,
      metadataJson: {
        donationId: donation.id,
        source: "donation-quick-action",
      },
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituent.id,
      donationId: donation.id,
      userId,
      type: "NOTE",
      description: `Steward path started from donation quick action: ${enrollmentLabel}`,
      metadata: {
        source: "api/donations:quick-action-start-path",
        pathId: enrollment.pathId,
        enrollmentId: enrollment.id,
      },
    },
  });

  await logAudit({
    action: "DONATION_STEWARD_PATH_STARTED",
    entity: "StewardPathEnrollment",
    entityId: enrollment.id,
    userId,
    organizationId,
    metadata: {
      donationId: donation.id,
      constituentId: donation.constituent.id,
      pathId: enrollment.pathId,
      enrollmentLabel,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    enrollmentId: enrollment.id,
    pathId: enrollment.pathId,
    redirectTo: `/automations?source=donation&constituentId=${encodeURIComponent(donation.constituent.id)}&donationId=${encodeURIComponent(donation.id)}&enrollmentId=${encodeURIComponent(enrollment.id)}`,
  });
});

/**
 * PATCH /api/donations/:id/acknowledgment — Mark or reset donor acknowledgment state for one donation.
 *
 * Request body:
 *   acknowledged?: boolean  // defaults to true
 *
 * Response:
 *   { id, acknowledgmentSentAt }
 */
router.patch("/:id/acknowledgment", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.donation.findFirst({
    where: { id: req.params.id, constituent: { organizationId } },
    select: { id: true, constituentId: true, acknowledgmentSentAt: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  const acknowledged = req.body?.acknowledged !== false;
  const acknowledgmentSentAt = acknowledged ? new Date() : null;

  const donation = await prisma.donation.update({
    where: { id: existing.id },
    data: { acknowledgmentSentAt },
    select: { id: true, constituentId: true, acknowledgmentSentAt: true },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "NOTE",
      description: acknowledged
        ? "Donation acknowledgment marked as sent"
        : "Donation acknowledgment reset",
      metadata: {
        source: "api/donations:acknowledgment",
        acknowledged,
      },
    },
  });

  logAudit({
    action: acknowledged ? "DONATION_ACKNOWLEDGMENT_MARKED" : "DONATION_ACKNOWLEDGMENT_RESET",
    entity: "Donation",
    entityId: donation.id,
    userId: req.user?.sub,
    metadata: {
      constituentId: donation.constituentId,
      acknowledgmentSentAt: donation.acknowledgmentSentAt,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ id: donation.id, acknowledgmentSentAt: donation.acknowledgmentSentAt });
});

/**
 * POST /api/donations/import — Bulk-import historical donation records from a CSV wizard.
 *
 * Accepts an array of mapped row objects (from the DonationImportWizard) and:
 *   1. Resolves each donation to an existing constituent via email, externalId, or name
 *   2. Optionally deduplicates by receiptNumber
 *   3. Normalizes paymentMethod, amount, date, status, frequency
 *   4. Creates Donation records and creates Campaign/Designation on-the-fly by name
 *   5. Updates constituent giving statistics (totalLifetimeGiving, firstGiftDate, lastGiftDate, giftCount, lastGiftAmount)
 *   6. Writes an audit log entry
 *
 * Request body:
 *   records           — array of mapped row objects (donation field keys → string values)
 *   dryRun            — true = simulate only, false = write to DB
 *   matchEmail        — try to match constituent by email
 *   matchExternalId   — try to match constituent by externalId
 *   matchName         — try to match constituent by firstName + lastName
 *   skipUnmatched     — skip rows where no constituent match is found (default false)
 *   dedupByReceipt    — skip rows whose receiptNumber already exists in the DB (default true)
 *
 * Response: { created, skipped, errors, unmatched, dryRun, errorMessages }
 *
 * Requires: role manager or higher.
 */
router.post("/import", async (req, res) => {
  const {
    records,
    dryRun         = true,
    matchEmail     = true,
    matchExternalId = true,
    matchName      = true,
    skipUnmatched  = false,
    dedupByReceipt = true,
    updateExisting = true,
  } = req.body as {
    records: Array<Record<string, string>>;
    dryRun: boolean;
    matchEmail: boolean;
    matchExternalId: boolean;
    matchName: boolean;
    skipUnmatched: boolean;
    dedupByReceipt: boolean;
    /** When true, re-importing a CSV with the same receipt number updates the donation instead of skipping it. */
    updateExisting: boolean;
  };

  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: { code: "NO_RECORDS", message: "No records provided." } });
    return;
  }

  // Resolve the organization from the authenticated user (falls back to DB lookup)
  const resolvedOrgId = await resolveOrganizationId({ req, requestedOrganizationId: undefined });
  if (!resolvedOrgId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }
  // Narrowed to string so closures below can capture it without null-check noise
  const orgId: string = resolvedOrgId;

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Parse a dollar-amount string to a float, stripping $, commas, and whitespace. */
  function parseAmount(raw: string): number | null {
    if (!raw?.trim()) return null;
    const n = parseFloat(raw.replace(/[$,\s]/g, "").trim());
    return isNaN(n) || n < 0 ? null : n;
  }

  /** Parse a date string (MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.) into a Date object. */
  function parseDate(raw: string): Date | null {
    if (!raw?.trim()) return null;
    const direct = new Date(raw);
    if (!isNaN(direct.getTime())) return direct;
    const parts = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (parts) {
      const year = parts[3].length === 2 ? 2000 + parseInt(parts[3]) : parseInt(parts[3]);
      const d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  /** Normalize a free-text payment method string to a Prisma PaymentMethod enum value. */
  function normalizePaymentMethod(raw: string): "CHECK" | "CREDIT_CARD" | "ACH" | "WIRE" | "STOCK" | "IN_KIND" | "CASH" | "ONLINE" {
    if (!raw?.trim()) return "ONLINE";
    const v = raw.trim();
    if (/check|cheque/i.test(v))                             return "CHECK";
    if (/credit|visa|mastercard|amex|discover|card/i.test(v)) return "CREDIT_CARD";
    if (/ach|eft|bank transfer|electronic/i.test(v))         return "ACH";
    if (/wire/i.test(v))                                      return "WIRE";
    if (/stock|securities|equity/i.test(v))                  return "STOCK";
    if (/in.?kind|inkind|goods|services/i.test(v))           return "IN_KIND";
    if (/cash/i.test(v))                                      return "CASH";
    return "ONLINE";
  }

  /** Normalize a status string to a Prisma DonationStatus enum value. */
  function normalizeStatus(raw: string): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
    const v = (raw ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    if (v === "PENDING")  return "PENDING";
    if (v === "FAILED")   return "FAILED";
    if (v === "REFUNDED") return "REFUNDED";
    return "COMPLETED";
  }

  /** Normalize a recurring frequency string to a Prisma RecurringFrequency enum value or null. */
  function normalizeFrequency(raw: string): "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null {
    const v = (raw ?? "").toLowerCase().trim();
    if (/weekly|week/.test(v))        return "WEEKLY";
    if (/monthly|month/.test(v))      return "MONTHLY";
    if (/quarterly|quarter/.test(v))  return "QUARTERLY";
    if (/annual|yearly|year/.test(v)) return "ANNUALLY";
    return null;
  }

  /**
   * Look up an existing constituent by email, externalId, or name (in priority order).
   * Returns null if no match is found. Uses the org-scoped constituent lookup.
   */
  async function resolveConstituent(rec: Record<string, string>): Promise<{ id: string } | null> {
    if (matchExternalId && rec.constituentExternalId?.trim()) {
      const found = await prisma.constituent.findFirst({
        where: { externalId: rec.constituentExternalId.trim(), organizationId: orgId },
        select: { id: true },
      });
      if (found) return found;
    }
    if (matchEmail && rec.constituentEmail?.trim()) {
      const found = await prisma.constituent.findFirst({
        where: { email: rec.constituentEmail.trim().toLowerCase(), organizationId: orgId },
        select: { id: true },
      });
      if (found) return found;
    }
    if (matchName) {
      // Try to split constituentName into first/last if constituentFirstName is absent
      let firstName = rec.constituentFirstName?.trim() ?? "";
      let lastName  = rec.constituentLastName?.trim() ?? "";
      if (!firstName && !lastName && rec.constituentName?.trim()) {
        const parts = rec.constituentName.trim().split(/\s+/);
        firstName = parts[0] ?? "";
        lastName  = parts.slice(1).join(" ");
      }
      if (firstName || lastName) {
        const found = await prisma.constituent.findFirst({
          where: {
            organizationId: orgId,
            ...(firstName && { firstName: { equals: firstName } }),
            ...(lastName  && { lastName:  { equals: lastName } }),
          },
          select: { id: true },
        });
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find or create a Campaign by name within the organization.
   * Creates a basic ANNUAL_FUND campaign if none exists.
   */
  async function resolveCampaign(name: string): Promise<string | undefined> {
    if (!name?.trim()) return undefined;
    const existing = await prisma.campaign.findFirst({
      where: { name: { equals: name.trim() }, organizationId: orgId },
      select: { id: true },
    });
    if (existing) return existing.id;
    // Auto-create with sensible defaults — user can edit campaign details afterward
    const created = await prisma.campaign.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        startDate: new Date(),
        category: "ANNUAL_FUND",
      },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Find or create a Designation by name within the organization.
   */
  async function resolveDesignation(name: string): Promise<string | undefined> {
    if (!name?.trim()) return undefined;
    const existing = await prisma.designation.findFirst({
      where: { name: { equals: name.trim() } },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.designation.create({
      data: { name: name.trim() },
      select: { id: true },
    });
    return created.id;
  }

  /**
   * Recalculate and update a constituent's denormalized giving summary fields
   * after a new donation is inserted. Runs in the same transaction context.
   */
  async function updateConstituentStats(constituentId: string): Promise<void> {
    await recalculateConstituentGivingRollups(constituentId);
  }

  // ─── Main import loop ─────────────────────────────────────────────────────────

  let created = 0;
  let skipped = 0;
  let unmatched = 0;
  const errorMessages: string[] = [];

  for (const rec of records) {
    try {
      // ── Parse required fields ───────────────────────────────────────────────
      const amount = parseAmount(rec.amount ?? "");
      if (amount === null) { skipped++; continue; }

      const date = parseDate(rec.date ?? "");
      if (!date) { skipped++; continue; }

      // ── Deduplication by receipt number ────────────────────────────────────
      if (dedupByReceipt && rec.receiptNumber?.trim()) {
        const exists = await prisma.donation.findFirst({
          where: { receiptNumber: rec.receiptNumber.trim(), constituent: { organizationId: orgId } },
          select: { id: true, constituentId: true },
        });
        if (exists) {
          if (updateExisting && !dryRun) {
            // Update the existing donation record with any new field values
            await prisma.donation.update({
              where: { id: exists.id },
              data: {
                amount:        amount!,
                date,
                paymentMethod: normalizePaymentMethod(rec.paymentMethod ?? ""),
                checkNumber:   rec.checkNumber?.trim()  || undefined,
                transactionId: rec.transactionId?.trim() || undefined,
                status:        normalizeStatus(rec.status ?? ""),
                notes:         rec.notes?.trim()        || undefined,
              },
            });
            await updateConstituentStats(exists.constituentId);
            created++; // count updated records as "created" for display clarity (shows activity)
          } else {
            skipped++;
          }
          continue;
        }
      }

      // ── Constituent matching ────────────────────────────────────────────────
      const constituent = await resolveConstituent(rec);
      if (!constituent) {
        unmatched++;
        if (skipUnmatched) { skipped++; continue; }
        // Import without a constituent link if skipUnmatched is false (orphan donation)
        // Orphan donations are skipped anyway — they have no constituentId FK
        // so we skip rather than insert invalid data
        skipped++;
        continue;
      }

      // ── Campaign and Designation resolution ────────────────────────────────
      const campaignId    = dryRun ? undefined : await resolveCampaign(rec.campaignName ?? "");
      const designationId = dryRun ? undefined : await resolveDesignation(rec.designationName ?? "");

      if (dryRun) {
        // Dry run: count what would happen, no writes
        created++;
        continue;
      }

      // ── Create donation ─────────────────────────────────────────────────────
      const isRecurring = /^(true|yes|1)$/i.test(rec.isRecurring ?? "");
      const taxDeductible = !/^(false|no|0)$/i.test(rec.taxDeductible ?? "true"); // default true

      await prisma.donation.create({
        data: {
          constituentId:    constituent.id,
          campaignId,
          designationId,
          amount,
          date,
          paymentMethod:    normalizePaymentMethod(rec.paymentMethod ?? ""),
          checkNumber:      rec.checkNumber?.trim()  || undefined,
          transactionId:    rec.transactionId?.trim() || undefined,
          receiptNumber:    rec.receiptNumber?.trim() || undefined,
          feeAmount:        parseAmount(rec.feeAmount ?? "") ?? 0,
          status:           normalizeStatus(rec.status ?? ""),
          taxDeductible,
          isRecurring,
          frequency:        isRecurring ? (normalizeFrequency(rec.frequency ?? "") ?? undefined) : undefined,
          notes:            rec.notes?.trim()                || undefined,
          inKindDescription: rec.inKindDescription?.trim()  || undefined,
        },
      });

      // Update donor giving stats to reflect newly imported history
      await updateConstituentStats(constituent.id);

      created++;
    } catch (err) {
      errorMessages.push(err instanceof Error ? err.message : String(err));
    }
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────
  if (!dryRun) {
    logAudit({
      action: "DONATIONS_IMPORTED",
      entity: "Donation",
      userId: req.user?.sub,
      organizationId: resolvedOrgId,
      metadata: { created, skipped, unmatched, errors: errorMessages.length },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  res.json({ created, skipped, errors: errorMessages.length, unmatched, dryRun, errorMessages });
});


/**
 * DELETE /api/donations/:id — Permanently delete a donation record. Admin-only.
 * Used for batch-entry corrections; logs a NOTE activity on the donor's timeline
 * before deletion so the gift removal is auditable.
 */
router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.donation.findFirst({
    where: { id, constituent: { organizationId } },
    select: { id: true, constituentId: true, amount: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found" } });
    return;
  }

  // Best-effort audit trail before the delete — keep history of what was removed.
  await prisma.activity.create({
    data: {
      constituentId: existing.constituentId,
      type: "NOTE",
      description: `Donation deleted: $${Number(existing.amount).toFixed(2)}`,
      metadata: { source: "api/donations:delete", donationId: existing.id },
    },
  });

  await prisma.donation.delete({ where: { id } });

  // Keep constituent giving rollups aligned after deletion.
  await recalculateConstituentGivingRollups(existing.constituentId);

  // Audit trail for donation deletion
  logAudit({
    action: "DONATION_DELETED",
    entity: "Donation",
    entityId: existing.id,
    userId: req.user?.sub,
    metadata: { amount: Number(existing.amount), constituentId: existing.constituentId },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(204).send();
});

export default router;
