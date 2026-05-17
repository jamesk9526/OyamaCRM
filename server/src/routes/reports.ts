/**
 * Analytics and reporting routes for OyamaCRM.
 * Provides aggregated dashboard metrics and downloadable report data.
 *
 * Routes:
 *   GET /api/reports/summary          — high-level dashboard KPIs (YTD revenue, task counts, etc.)
 *   GET /api/reports/giving-by-month  — monthly donation totals for a given year
 *   GET /api/reports/donor-retention  — year-over-year donor retention rate
 *   GET /api/reports/top-donors       — top N donors by total lifetime giving
 *
 * @module routes/reports
 */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { completedDonationWhere } from "../lib/donationScope.js";
import { generateLetterFromTemplate } from "../services/letters-execution.js";
import {
  getYearRange,
  getFiscalYearForDate,
  getFiscalYearRange,
  getFiscalYTDRange,
  normalizeFiscalYearStart,
  getStartOfWeek,
  calcRetentionRate,
  calcYoYPercent,
} from "../lib/dateRanges.js";

const router = Router();
const OSHAREVIEW_NOTES_PLUGIN_KEY = "oshareview-notes";
const OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY = "oshareview-blueprints";

interface OShareviewNote {
  id: string;
  body: string;
  priority: "info" | "important" | "urgent";
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
}

interface OShareviewReportBlueprint {
  id: string;
  name: string;
  description: string;
  module: "donor" | "events" | "compassion" | "ogentic" | "admin";
  tool: string;
  tab: "overview" | "donors" | "giving" | "campaigns" | "retention";
  year: number;
  allYears: boolean;
  includeGrants: boolean;
  exportMode: "csv" | "server_csv" | "print";
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  createdByName: string;
}

// All report routes require authentication — report data is sensitive org information.
router.use(requireAuth);
router.use(requirePermission("view:reports"));

/** Filters orphan-safe task counts to the active installation organization. */
function taskOrganizationWhere(organizationId: string) {
  return {
    OR: [
      { constituent: { organizationId } },
      { assignee: { organizationId } },
      { createdBy: { organizationId } },
    ],
  };
}

function parseDateQueryValue(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildDateWindowFilter(fromDateRaw: string | undefined, toDateRaw: string | undefined): Prisma.DateTimeFilter | undefined {
  let fromDate = parseDateQueryValue(fromDateRaw);
  let toDate = parseDateQueryValue(toDateRaw);
  if (!fromDate && !toDate) return undefined;

  // Normalize accidental inverted windows by swapping endpoints.
  if (fromDate && toDate && fromDate > toDate) {
    const swap = fromDate;
    fromDate = toDate;
    toDate = swap;
  }

  const filter: Prisma.DateTimeFilter = {};
  if (fromDate) {
    filter.gte = fromDate;
  }
  if (toDate) {
    // Treat "to" as inclusive of the selected day.
    filter.lte = new Date(toDate.getTime() + (24 * 60 * 60 * 1000) - 1);
  }
  return filter;
}

function mergeDateFilters(base?: Prisma.DateTimeFilter, extra?: Prisma.DateTimeFilter): Prisma.DateTimeFilter | undefined {
  if (!base && !extra) return undefined;
  if (!base) return extra;
  if (!extra) return base;

  const merged: Prisma.DateTimeFilter = {
    ...base,
    ...extra,
  };

  if (base.gte && extra.gte) {
    merged.gte = base.gte > extra.gte ? base.gte : extra.gte;
  }
  if (base.lte && extra.lte) {
    merged.lte = base.lte < extra.lte ? base.lte : extra.lte;
  }
  if (base.lt && extra.lt) {
    merged.lt = base.lt < extra.lt ? base.lt : extra.lt;
  }

  return merged;
}

/** Parses report scope from query params and returns year + optional date range filters. */
async function parseReportScope(rawQuery: unknown, organizationId?: string | null) {
  const query = (rawQuery ?? {}) as Record<string, string | string[] | undefined>;
  const yearQuery = Array.isArray(query.year) ? query.year[0] : query.year;
  const scopeQuery = Array.isArray(query.scope) ? query.scope[0] : query.scope;
  const fromDateQuery = Array.isArray(query.fromDate) ? query.fromDate[0] : query.fromDate;
  const toDateQuery = Array.isArray(query.toDate) ? query.toDate[0] : query.toDate;
  const dateBasisQuery = Array.isArray(query.dateBasis) ? query.dateBasis[0] : query.dateBasis;
  const useFiscalYear = dateBasisQuery === "fiscal";
  const settings = organizationId && useFiscalYear
    ? await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { fiscalYearStart: true },
    })
    : null;
  const fiscalYearStart = normalizeFiscalYearStart(settings?.fiscalYearStart);
  const now = new Date();
  const currentYear = useFiscalYear ? getFiscalYearForDate(now, fiscalYearStart) : now.getFullYear();
  const parsedYear = Number.parseInt(yearQuery ?? String(currentYear), 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;
  const useAllYears = scopeQuery?.toUpperCase() === "ALL_YEARS";
  const fullYearRange = useFiscalYear ? getFiscalYearRange(year, fiscalYearStart) : getYearRange(year);
  const customDateFilter = buildDateWindowFilter(fromDateQuery, toDateQuery);
  // For the active reporting year, use true YTD so dashboard values match the current topbar reporting mode.
  const ytdRange = useFiscalYear ? getFiscalYTDRange(fiscalYearStart, now) : { gte: new Date(year, 0, 1), lte: now };
  const scopedRange = year === currentYear ? ytdRange : fullYearRange;
  const scopedDonationFilter = useAllYears ? undefined : scopedRange;
  const scopedGrantFilter = useAllYears ? undefined : scopedRange;

  return {
    year,
    dateBasis: useFiscalYear ? "fiscal" as const : "calendar" as const,
    fiscalYearStart,
    useAllYears,
    yearRange: scopedRange,
    donationDateFilter: mergeDateFilters(scopedDonationFilter, customDateFilter),
    grantAwardedAtFilter: mergeDateFilters(scopedGrantFilter, customDateFilter),
    customDateFilter,
  };
}

/** Returns campaigns that overlap a target reporting range. */
function campaignOverlapRangeFilter(range: { gte: Date; lt?: Date; lte?: Date }) {
  const rangeEnd = range.lt ?? range.lte ?? new Date(range.gte.getFullYear() + 1, 0, 1);
  return {
    AND: [
      { startDate: { lt: rangeEnd } },
      {
        OR: [
          { endDate: null },
          { endDate: { gte: range.gte } },
        ],
      },
    ],
  };
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const next = value.trim().toLowerCase();
  return next.length > 0 ? next : null;
}

function formatScopeLabel(params: { dateBasis: "calendar" | "fiscal"; year: number }): string {
  return params.dateBasis === "fiscal" ? `FY ${params.year}` : String(params.year);
}

function pluralizeDonor(count: number): string {
  return `${count} donor${count === 1 ? "" : "s"}`;
}

/**
 * Evaluates one permission key using explicit UserPermission overrides, matching middleware behavior.
 */
async function userCanPermission(req: { user?: { sub?: string; role?: string } }, permission: PermissionKey): Promise<boolean> {
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

  if (override && !override.granted) return false;
  if (override && override.granted) return true;
  return hasDefaultPermission(role, permission);
}

/** Returns report freshness metadata for UI badges and API clients. */
function buildFreshnessMetadata(dataThrough: Date = new Date()) {
  return {
    generatedAt: new Date().toISOString(),
    dataThrough: dataThrough.toISOString(),
  };
}

/** Escapes one CSV cell for safe spreadsheet output. */
function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replace(/\"/g, '""')}"`;
  }
  return raw;
}

/** Serializes row objects into CSV text. */
function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

/** Reads persisted OShareview admin notes from plugin config payload. */
function normalizeOShareviewNotes(config: unknown): OShareviewNote[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const rawNotes = (config as Record<string, unknown>).notes;
  if (!Array.isArray(rawNotes)) return [];

  return rawNotes
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const note = entry as Record<string, unknown>;
      const priority: OShareviewNote["priority"] = note.priority === "urgent" || note.priority === "important" ? note.priority : "info";
      return {
        id: typeof note.id === "string" ? note.id : "",
        body: typeof note.body === "string" ? note.body : "",
        priority,
        createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date().toISOString(),
        createdByUserId: typeof note.createdByUserId === "string" ? note.createdByUserId : "",
        createdByName: typeof note.createdByName === "string" ? note.createdByName : "Admin",
      };
    })
    .filter((note) => note.id && note.body.trim().length > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);
}

/** Reads persisted OShareview report blueprints from plugin config payload. */
function normalizeOShareviewBlueprints(config: unknown): OShareviewReportBlueprint[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const rawBlueprints = (config as Record<string, unknown>).blueprints;
  if (!Array.isArray(rawBlueprints)) return [];

  const modules = new Set(["donor", "events", "compassion", "ogentic", "admin"]);
  const tabs = new Set(["overview", "donors", "giving", "campaigns", "retention"]);
  const exportModes = new Set(["csv", "server_csv", "print"]);

  return rawBlueprints
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const blueprint = entry as Record<string, unknown>;
      const moduleName = modules.has(String(blueprint.module)) ? (blueprint.module as OShareviewReportBlueprint["module"]) : "donor";
      const tab = tabs.has(String(blueprint.tab)) ? (blueprint.tab as OShareviewReportBlueprint["tab"]) : "overview";
      const exportMode = exportModes.has(String(blueprint.exportMode))
        ? (blueprint.exportMode as OShareviewReportBlueprint["exportMode"])
        : "csv";

      return {
        id: typeof blueprint.id === "string" ? blueprint.id : "",
        name: typeof blueprint.name === "string" ? blueprint.name : "",
        description: typeof blueprint.description === "string" ? blueprint.description : "",
        module: moduleName,
        tool: typeof blueprint.tool === "string" ? blueprint.tool : "donor-overview",
        tab,
        year: Number.isFinite(blueprint.year) ? Number(blueprint.year) : new Date().getFullYear(),
        allYears: Boolean(blueprint.allYears),
        includeGrants: Boolean(blueprint.includeGrants),
        exportMode,
        createdAt: typeof blueprint.createdAt === "string" ? blueprint.createdAt : new Date().toISOString(),
        updatedAt: typeof blueprint.updatedAt === "string" ? blueprint.updatedAt : new Date().toISOString(),
        createdByUserId: typeof blueprint.createdByUserId === "string" ? blueprint.createdByUserId : "",
        createdByName: typeof blueprint.createdByName === "string" ? blueprint.createdByName : "Admin",
      };
    })
    .filter((blueprint) => blueprint.id && blueprint.name.trim().length > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 100);
}

/** GET /api/reports/oshareview-notes — returns latest admin broadcast notes for OShareview users. */
router.get("/oshareview-notes", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ notes: [] as OShareviewNote[] });
    return;
  }

  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_NOTES_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  res.json({ notes: normalizeOShareviewNotes(setting?.config) });
});

/** POST /api/reports/oshareview-notes — admin-only note broadcast tool for OShareview users. */
router.post("/oshareview-notes", async (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can post OShareview notes." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const body = String(req.body?.body ?? "").trim();
  const priority: OShareviewNote["priority"] = req.body?.priority === "urgent" || req.body?.priority === "important" ? req.body.priority : "info";
  if (!body) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Note body is required." } });
    return;
  }

  const existing = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_NOTES_PLUGIN_KEY,
      },
    },
    select: { id: true, config: true },
  });

  const notes = normalizeOShareviewNotes(existing?.config);
  const createdByName = req.user?.email ?? "Admin";
  const nextNote: OShareviewNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    body,
    priority,
    createdAt: new Date().toISOString(),
    createdByUserId: req.user?.sub ?? "",
    createdByName,
  };

  const nextNotes = [nextNote, ...notes].slice(0, 40);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_NOTES_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: OSHAREVIEW_NOTES_PLUGIN_KEY,
      enabled: true,
      config: { notes: nextNotes } as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: { notes: nextNotes } as unknown as Prisma.InputJsonValue,
    },
  });

  res.status(201).json({ note: nextNote, notes: nextNotes });
});

/** GET /api/reports/oshareview-blueprints — returns saved report blueprints for OShareview. */
router.get("/oshareview-blueprints", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ blueprints: [] as OShareviewReportBlueprint[] });
    return;
  }

  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  res.json({ blueprints: normalizeOShareviewBlueprints(setting?.config) });
});

/** POST /api/reports/oshareview-blueprints — admin-only blueprint save endpoint. */
router.post("/oshareview-blueprints", async (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can manage OShareview blueprints." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Blueprint name is required." } });
    return;
  }

  const existing = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const current = normalizeOShareviewBlueprints(existing?.config);
  const nextBlueprint: OShareviewReportBlueprint = {
    id: `blueprint_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: String(req.body?.description ?? "").trim(),
    module: req.body?.module === "events" || req.body?.module === "compassion" || req.body?.module === "ogentic" || req.body?.module === "admin" ? req.body.module : "donor",
    tool: typeof req.body?.tool === "string" ? req.body.tool : "donor-overview",
    tab: req.body?.tab === "donors" || req.body?.tab === "giving" || req.body?.tab === "campaigns" || req.body?.tab === "retention" ? req.body.tab : "overview",
    year: Number.isFinite(req.body?.year) ? Number(req.body.year) : new Date().getFullYear(),
    allYears: Boolean(req.body?.allYears),
    includeGrants: Boolean(req.body?.includeGrants),
    exportMode: req.body?.exportMode === "server_csv" || req.body?.exportMode === "print" ? req.body.exportMode : "csv",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByUserId: req.user?.sub ?? "",
    createdByName: req.user?.email ?? "Admin",
  };

  const nextBlueprints = [nextBlueprint, ...current].slice(0, 100);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      enabled: true,
      config: { blueprints: nextBlueprints } as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: { blueprints: nextBlueprints } as unknown as Prisma.InputJsonValue,
    },
  });

  res.status(201).json({ blueprint: nextBlueprint, blueprints: nextBlueprints });
});

/** DELETE /api/reports/oshareview-blueprints/:id — admin-only remove endpoint. */
router.delete("/oshareview-blueprints/:id", async (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can manage OShareview blueprints." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const targetId = String(req.params.id ?? "").trim();
  if (!targetId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Blueprint id is required." } });
    return;
  }

  const existing = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const current = normalizeOShareviewBlueprints(existing?.config);
  const nextBlueprints = current.filter((item) => item.id !== targetId);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: OSHAREVIEW_BLUEPRINTS_PLUGIN_KEY,
      enabled: true,
      config: { blueprints: nextBlueprints } as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: { blueprints: nextBlueprints } as unknown as Prisma.InputJsonValue,
    },
  });

  res.json({ blueprints: nextBlueprints });
});

/**
 * GET /api/reports/summary — Return high-level org-wide KPIs for the dashboard header cards.
 * Runs all aggregation queries concurrently to minimise response latency.
 */
router.get("/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { useAllYears, yearRange, donationDateFilter, grantAwardedAtFilter } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json({
      totalConstituents: 0,
      ytdAmount: 0,
      ytdCount: 0,
      ytdGrantAmount: 0,
      activeCampaignRaisedAmount: 0,
      weekAmount: 0,
      weekCount: 0,
      weekAvg: 0,
      activeCampaigns: 0,
      activeGoalTotal: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      freshness: buildFreshnessMetadata(),
    });
    return;
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = getStartOfWeek();

  const [
    totalConstituents,
    ytdDonations,
    weekDonations,
    monthDonations,
    lastMonthDonations,
    activeCampaigns,
    pendingTasks,
    overdueTasks,
    activeCampaignGoal,
    activeCampaignRaised,
    newDonorsThisMonth,
    // YTD awarded grants — amountAwarded where status=AWARDED and awardedAt is this year.
    ytdGrants,
  ] = await Promise.all([
    prisma.constituent.count({ where: { organizationId } }),
    // YTD completed donations — scoped to selected year unless ALL_YEARS is requested
    prisma.donation.aggregate({
      where: completedDonationWhere(organizationId, donationDateFilter),
      _sum: { amount: true },
      _count: true,
    }),
    // This week's donations
    prisma.donation.aggregate({
      where: completedDonationWhere(organizationId, { gte: startOfWeek }),
      _sum: { amount: true },
      _count: true,
    }),
    // This month's donations (for trend comparison)
    prisma.donation.aggregate({
      where: completedDonationWhere(organizationId, { gte: startOfMonth }),
      _sum: { amount: true },
      _count: true,
    }),
    // Last month's donations (for MoM trend) — exclusive end = start of current month
    prisma.donation.aggregate({
      where: completedDonationWhere(organizationId, { gte: startOfLastMonth, lt: startOfMonth }),
      _sum: { amount: true },
      _count: true,
    }),
    prisma.campaign.count({
      where: {
        organizationId,
        ...(useAllYears ? {} : campaignOverlapRangeFilter(yearRange)),
      },
    }),
    prisma.task.count({ where: { status: "PENDING", ...taskOrganizationWhere(organizationId) } }),
    prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now }, ...taskOrganizationWhere(organizationId) } }),
    // Sum of goals across campaigns in the selected scope
    prisma.campaign.aggregate({
      where: {
        organizationId,
        goal: { not: null },
        ...(useAllYears ? {} : campaignOverlapRangeFilter(yearRange)),
      },
      _sum: { goal: true },
    }),
    // Scoped completed donations tied to campaigns in the selected report scope.
    prisma.donation.aggregate({
      where: {
        ...completedDonationWhere(organizationId, donationDateFilter),
        campaign: {
          is: {
            organizationId,
            ...(useAllYears ? {} : campaignOverlapRangeFilter(yearRange)),
          },
        },
      },
      _sum: { amount: true },
    }),
    // Constituents whose first recorded gift is in the selected year.
    prisma.constituent.count({
      where: { organizationId, ...(useAllYears ? {} : { firstGiftDate: yearRange }) },
    }),
    // Scoped awarded grants — filtered to selected year unless ALL_YEARS.
    // amountAwarded is used (not amountRequested) since this is what was actually received.
    prisma.grant.aggregate({
      where: {
        organizationId,
        status: "AWARDED",
        ...(grantAwardedAtFilter ? { awardedAt: grantAwardedAtFilter } : {}),
        amountAwarded: { not: null },
      },
      _sum: { amountAwarded: true },
    }),
  ]);

  const weekAmt = Number(weekDonations._sum.amount ?? 0);
  const weekCount = weekDonations._count;
  const monthAmt = Number(monthDonations._sum.amount ?? 0);
  const lastMonthAmt = Number(lastMonthDonations._sum.amount ?? 0);
  // Month-over-month trend using safe division (null when no prior-month data)
  const momTrend = calcYoYPercent(monthAmt, lastMonthAmt);

  res.json({
    totalConstituents,
    ytdAmount: Number(ytdDonations._sum.amount ?? 0),
    ytdCount: ytdDonations._count,
    // ytdGrantAmount is always returned separately so the UI can decide whether to include it
    ytdGrantAmount: Number(ytdGrants._sum.amountAwarded ?? 0),
    activeCampaignRaisedAmount: Number(activeCampaignRaised._sum.amount ?? 0),
    weekAmount: weekAmt,
    weekCount,
    weekAvg: weekCount > 0 ? weekAmt / weekCount : 0,
    monthAmount: monthAmt,
    monthCount: monthDonations._count,
    momTrend,
    newDonorsThisMonth,
    activeCampaigns,
    activeGoalTotal: Number(activeCampaignGoal._sum.goal ?? 0),
    pendingTasks,
    overdueTasks,
    freshness: buildFreshnessMetadata(new Date()),
  });
});

/**
 * POST /api/reports/actions/draft-thank-you-new-donors
 *
 * Creates the "Best next move" draft pack for newly acquired donors in the active reporting scope:
 * 1) communications email draft tied to either a temp saved segment (many) or one individual (single)
 * 2) letters draft split for donors who cannot be emailed
 */
router.post("/actions/draft-thank-you-new-donors", requirePermission("edit:communications"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Organization and authenticated user are required." } });
    return;
  }

  const scope = await parseReportScope(req.query, organizationId);
  const scopeLabel = formatScopeLabel({ dateBasis: scope.dateBasis, year: scope.year });
  const stamp = new Date().toISOString().slice(0, 10);

  const cohort = await prisma.constituent.findMany({
    where: {
      organizationId,
      ...(scope.useAllYears ? { firstGiftDate: { not: null } } : { firstGiftDate: scope.yearRange }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      doNotEmail: true,
      doNotMail: true,
      doNotContact: true,
      emailOptOut: true,
      firstGiftDate: true,
    },
    orderBy: { firstGiftDate: "desc" },
    take: 200,
  });

  if (cohort.length === 0) {
    res.status(200).json({
      message: `No newly acquired donors were found for ${scopeLabel}.`,
      scope: { dateBasis: scope.dateBasis, year: scope.year, label: scopeLabel },
      counts: {
        cohort: 0,
        emailable: 0,
        lettersNeeded: 0,
        suppressed: 0,
      },
    });
    return;
  }

  const emailable = cohort.filter((row) => {
    const email = normalizeEmail(row.email);
    if (!email) return false;
    if (row.doNotContact) return false;
    if (row.doNotEmail) return false;
    if (row.emailOptOut) return false;
    return true;
  });
  const emailableIds = new Set(emailable.map((row) => row.id));

  const lettersNeeded = cohort.filter((row) => {
    if (emailableIds.has(row.id)) return false;
    if (row.doNotContact) return false;
    if (row.doNotMail) return false;
    return true;
  });
  const lettersNeededIds = new Set(lettersNeeded.map((row) => row.id));

  const suppressed = cohort.filter((row) => !emailableIds.has(row.id) && !lettersNeededIds.has(row.id));

  let recipientListId: string | null = null;
  let communicationsDraftId: string | null = null;
  let communicationsRedirectTo: string | null = null;

  if (emailable.length > 0) {
    if (emailable.length > 1) {
      const tempList = await prisma.emailRecipientList.create({
        data: {
          organizationId,
          name: `Temp Segment: New Donors Thank-You (${scopeLabel}) - ${emailable.length}`,
          description: `Auto-generated temporary segment from Dashboard Command Center on ${stamp}.`,
          createdById: userId,
        },
        select: { id: true },
      });
      recipientListId = tempList.id;

      await prisma.emailRecipientListMember.createMany({
        data: emailable.flatMap((row) => {
          const email = normalizeEmail(row.email);
          if (!email) return [];
          return [{
            listId: tempList.id,
            email,
            firstName: row.firstName,
            lastName: row.lastName,
          }];
        }),
        skipDuplicates: true,
      });
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { smtpFromName: true, smtpFromEmail: true },
    });

    const selectionMode = emailable.length === 1 ? "INDIVIDUAL" : "SAVED_LIST";
    const individualRecipientEmail = emailable.length === 1 ? normalizeEmail(emailable[0].email) : null;

    const campaign = await prisma.emailCampaign.create({
      data: {
        organizationId,
        name: `Draft Thank-You: New Donors (${scopeLabel}) - ${emailable.length}`,
        subject: "Thank you for your first gift",
        purpose: "THANK_YOU",
        previewText: `Stewardship thank-you draft for ${pluralizeDonor(emailable.length)} in ${scopeLabel}.`,
        fromName: settings?.smtpFromName || "OyamaCRM",
        fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
        bodyText: [
          "Dear Friend,",
          "",
          "Thank you for your recent gift and for joining this mission with us.",
          "Your generosity makes this work possible, and we are grateful to welcome you as a new donor.",
          "",
          "With gratitude,",
          "{{staffName}}",
        ].join("\n"),
        bodyHtml: "<p>Dear Friend,</p><p>Thank you for your recent gift and for joining this mission with us. Your generosity makes this work possible, and we are grateful to welcome you as a new donor.</p><p>With gratitude,<br/>{{staffName}}</p>",
        audienceFilter: JSON.stringify({
          type: "new",
          source: "dashboard-next-move",
          sourceAction: "draft-thank-you-new-donors",
          scopeLabel,
          cohortConstituentIds: cohort.map((row) => row.id),
          selectionMode,
          recipientConstituentIds: emailable.map((row) => row.id),
          recipientListId,
          individualRecipientEmail,
          _quickSelection: {
            sendMode: selectionMode === "INDIVIDUAL" ? "INDIVIDUAL" : "SAVED_LIST",
            recipientListId,
            individualRecipientEmail,
          },
          _sharing: {
            ownerId: userId,
            sharedWithOrganization: true,
          },
          _workflow: {
            preparationStatus: "DRAFT",
          },
        }),
        status: "DRAFT",
      },
      select: { id: true },
    });

    communicationsDraftId = campaign.id;
    communicationsRedirectTo = `/communications/${campaign.id}?mode=send`;

    await prisma.activity.createMany({
      data: emailable.map((row) => ({
        constituentId: row.id,
        userId,
        type: "NOTE",
        description: `Dashboard next move created thank-you email draft for new donor cohort (${scopeLabel}).`,
        metadata: {
          source: "api/reports:actions/draft-thank-you-new-donors",
          campaignId: campaign.id,
          selectionMode,
          recipientListId,
        } as Prisma.InputJsonValue,
      })),
    });
  }

  const canCreateLetters = await userCanPermission(req, "letters.create");
  const canGenerateLetters = await userCanPermission(req, "letters.generate");
  const canBuildLetters = canCreateLetters && canGenerateLetters;

  let lettersTemplateId: string | null = null;
  let lettersRedirectTo: string | null = null;
  let generatedLetterCount = 0;

  if (lettersNeeded.length > 0 && canBuildLetters) {
    const letterTemplate = await prisma.letterTemplate.create({
      data: {
        organizationId,
        name: `Draft Thank-You Letters: New Donors Missing Email (${scopeLabel}) - ${lettersNeeded.length}`,
        category: "THANK_YOU",
        description: `Auto-generated from Dashboard Command Center on ${stamp} for donors missing emailable addresses.`,
        status: "DRAFT",
        printSubject: "Thank you for your support",
        printBody: [
          "{{donor.salutation}}",
          "",
          "Thank you for your recent gift and for joining this mission with us.",
          "Your support already makes a meaningful difference.",
          "",
          "With gratitude,",
          "{{staff.fullName}}",
        ].join("\n"),
        emailSubject: "Thank you for your support",
        emailBody: [
          "{{donor.salutation}}",
          "",
          "Thank you for your recent gift and for joining this mission with us.",
          "Your support already makes a meaningful difference.",
          "",
          "With gratitude,",
          "{{staff.fullName}}",
        ].join("\n"),
        crmScope: "DONOR",
        createdByUserId: userId,
        updatedByUserId: userId,
      },
      select: { id: true },
    });

    lettersTemplateId = letterTemplate.id;

    for (const row of lettersNeeded.slice(0, 100)) {
      const created = await generateLetterFromTemplate({
        organizationId,
        templateId: letterTemplate.id,
        actorUserId: userId,
        constituentId: row.id,
        year: scope.year,
      });
      if (created?.generated?.id) {
        generatedLetterCount += 1;
      }
    }

    lettersRedirectTo = `/letters-printables/generated?templateId=${encodeURIComponent(letterTemplate.id)}`;
  }

  if (!communicationsDraftId && !lettersTemplateId) {
    res.status(200).json({
      message: `No draft workspaces were created for ${scopeLabel}.`,
      scope: { dateBasis: scope.dateBasis, year: scope.year, label: scopeLabel },
      counts: {
        cohort: cohort.length,
        emailable: emailable.length,
        lettersNeeded: lettersNeeded.length,
        suppressed: suppressed.length,
      },
      warnings: {
        lettersPermissionMissing: lettersNeeded.length > 0 && !canBuildLetters,
      },
    });
    return;
  }

  const primaryRedirectTo = communicationsRedirectTo || lettersRedirectTo || "/";

  res.status(201).json({
    message: `Created stewardship drafts for ${pluralizeDonor(cohort.length)} in ${scopeLabel}.`,
    scope: { dateBasis: scope.dateBasis, year: scope.year, label: scopeLabel },
    counts: {
      cohort: cohort.length,
      emailable: emailable.length,
      lettersNeeded: lettersNeeded.length,
      suppressed: suppressed.length,
      generatedLetters: generatedLetterCount,
    },
    communications: communicationsDraftId
      ? {
          campaignId: communicationsDraftId,
          recipientListId,
          redirectTo: communicationsRedirectTo,
        }
      : null,
    letters: lettersTemplateId
      ? {
          templateId: lettersTemplateId,
          generatedCount: generatedLetterCount,
          redirectTo: lettersRedirectTo,
        }
      : null,
    warnings: {
      lettersPermissionMissing: lettersNeeded.length > 0 && !canBuildLetters,
    },
    redirectTo: primaryRedirectTo,
  });
});

/**
 * GET /api/reports/exports/summary.csv
 * Exports summary KPIs to CSV. Permission-gated to users who can export org data.
 */
router.get("/exports/summary.csv", requirePermission("export:data"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const now = new Date();
  const thisYear = now.getFullYear();
  const ytd = await prisma.donation.aggregate({
    where: completedDonationWhere(organizationId, { gte: new Date(thisYear, 0, 1), lte: now }),
    _sum: { amount: true },
    _count: true,
  });
  const activeCampaigns = await prisma.campaign.count({ where: { organizationId, active: true } });
  const pendingTasks = await prisma.task.count({ where: { status: "PENDING", ...taskOrganizationWhere(organizationId) } });
  const overdueTasks = await prisma.task.count({
    where: { status: "PENDING", dueDate: { lt: now }, ...taskOrganizationWhere(organizationId) },
  });

  const freshness = buildFreshnessMetadata(now);
  const csv = buildCsv([
    {
      year: thisYear,
      ytdAmount: Number(ytd._sum.amount ?? 0),
      ytdCount: ytd._count,
      activeCampaigns,
      pendingTasks,
      overdueTasks,
      generatedAt: freshness.generatedAt,
      dataThrough: freshness.dataThrough,
    },
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=reports-summary-${thisYear}.csv`);
  res.status(200).send(csv);
});

/**
 * GET /api/reports/exports/giving-by-month.csv?year=YYYY
 * Exports monthly giving totals to CSV for offline reporting.
 */
router.get("/exports/giving-by-month.csv", requirePermission("export:data"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const yearQuery = Number.parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
  const year = Number.isFinite(yearQuery) ? yearQuery : new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const donations = await prisma.donation.findMany({
    where: completedDonationWhere(organizationId, { gte: start, lt: end }),
    select: { date: true, amount: true },
  });

  const byMonth = Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    const amount = donations
      .filter((donation) => donation.date.getMonth() + 1 === month)
      .reduce((sum, donation) => sum + Number(donation.amount), 0);
    return { month, amount };
  });

  const freshness = buildFreshnessMetadata(new Date());
  const csv = buildCsv(
    byMonth.map((row) => ({
      year,
      month: row.month,
      amount: row.amount,
      generatedAt: freshness.generatedAt,
      dataThrough: freshness.dataThrough,
    }))
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=giving-by-month-${year}.csv`);
  res.status(200).send(csv);
});

/**
 * GET /api/reports/giving-by-month?year=YYYY — Monthly donation totals for a given calendar year.
 * Aggregates COMPLETED donations in application code to stay DB-agnostic.
 * Returns an array of 12 objects: `{ month: 1-12, amount: number, grantAmount: number }`.
 * `grantAmount` is always included (may be 0) so the frontend can optionally stack it.
 */
router.get("/giving-by-month", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0, grantAmount: 0 })));
    return;
  }

  const { donationDateFilter, grantAwardedAtFilter } = await parseReportScope(req.query, organizationId);

  // Fetch donations and grants concurrently
  const [donations, grants] = await Promise.all([
    prisma.donation.findMany({
      where: completedDonationWhere(organizationId, donationDateFilter),
      select: { date: true, amount: true },
    }),
    // Awarded grants with an awardedAt date in this year; amountAwarded may be null so filter it out.
    prisma.grant.findMany({
      where: {
        organizationId,
        status: "AWARDED",
        ...(grantAwardedAtFilter ? { awardedAt: grantAwardedAtFilter } : {}),
        amountAwarded: { not: null },
      },
      select: { awardedAt: true, amountAwarded: true },
    }),
  ]);

  // Aggregate by month number 1–12 in application code (avoids SQL MONTH() dialect differences)
  const byMonth: Record<number, number> = {};
  donations.forEach((d) => {
    const month = new Date(d.date).getMonth() + 1;
    byMonth[month] = (byMonth[month] ?? 0) + Number(d.amount);
  });

  const grantByMonth: Record<number, number> = {};
  grants.forEach((g) => {
    if (!g.awardedAt) return;
    const month = new Date(g.awardedAt).getMonth() + 1;
    grantByMonth[month] = (grantByMonth[month] ?? 0) + Number(g.amountAwarded ?? 0);
  });

  const result = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    amount: byMonth[i + 1] ?? 0,
    grantAmount: grantByMonth[i + 1] ?? 0,
  }));

  res.json(result);
});

/**
 * GET /api/reports/donor-retention — Compute year-over-year donor retention rate.
 * Formula: (donors who gave in both lastYear AND thisYear) / (donors who gave in lastYear) × 100.
 */
router.get("/donor-retention", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { year: thisYear, dateBasis, fiscalYearStart, yearRange: thisYearRange } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json({ total: 0, retained: 0, rate: 0, year: thisYear });
    return;
  }

  const lastYear = thisYear - 1;
  const lastYearRange = dateBasis === "fiscal" ? getFiscalYearRange(lastYear, fiscalYearStart) : getYearRange(lastYear);

  const [lastYearDonors, thisYearDonors] = await Promise.all([
    // Unique constituent IDs who donated last year (base cohort for retention rate)
    prisma.donation.findMany({
      where: {
        status: "COMPLETED",
        date: lastYearRange,
        constituent: { organizationId },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: {
        status: "COMPLETED",
        date: thisYearRange,
        constituent: { organizationId },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  const total = lastYearDonors.length;
  const thisYearSet = new Set(thisYearDonors.map((donor) => donor.constituentId));
  const retained = lastYearDonors.filter((donor) => thisYearSet.has(donor.constituentId)).length;
  // Use shared helper — returns 0 (not NaN) when total is 0
  const rate = calcRetentionRate(retained, total);

  res.json({ total, retained, rate, year: thisYear });
});

/**
 * GET /api/reports/top-donors?limit=N — Top N constituents by total lifetime giving amount.
 * Defaults to top 10. Only includes constituents with at least one recorded gift.
 */
router.get("/top-donors", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { donationDateFilter } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "10", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 5000) : 10;

  const grouped = await prisma.donation.groupBy({
    by: ["constituentId"],
    where: {
      ...completedDonationWhere(organizationId, donationDateFilter),
    },
    _sum: { amount: true },
    _max: { date: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) {
    res.json([]);
    return;
  }

  const constituentIds = grouped
    .map((row) => row.constituentId)
    .filter((id): id is string => Boolean(id));

  const constituents = await prisma.constituent.findMany({
    where: {
      organizationId,
      id: { in: constituentIds },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      donorStatus: true,
    },
  });

  const constituentMap = new Map(constituents.map((c) => [c.id, c]));

  const donors = grouped
    .map((row) => {
      const constituent = row.constituentId ? constituentMap.get(row.constituentId) : undefined;
      if (!constituent) return null;
      return {
        id: constituent.id,
        firstName: constituent.firstName,
        lastName: constituent.lastName,
        email: constituent.email,
        donorStatus: constituent.donorStatus,
        totalLifetimeGiving: Number(row._sum?.amount ?? 0),
        lastGiftDate: row._max?.date ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  res.json(donors);
});

/**
 * GET /api/reports/board-summary
 * Simplified KPI summary for the board member dashboard (report_viewer role).
 * Returns ytdRevenue, goal, donorRetentionRate, totalDonors, newDonorsYtd, totalGiftsYtd,
 * averageGift, majorGiftCount, and monthlyTrend[].
 * Accessible to all authenticated users including report_viewer.
 */
router.get("/board-summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { year, useAllYears, yearRange, donationDateFilter, grantAwardedAtFilter } = await parseReportScope(req.query, organizationId);
  const empty = {
    summary: {
      ytdRevenue: 0,
      ytdGoal: 0,
      donorRetentionRate: 0,
      totalDonors: 0,
      newDonorsYtd: 0,
      totalGiftsYtd: 0,
      averageGift: 0,
      majorGiftCount: 0,
    },
    monthlyTrend: [] as { label: string; amount: number }[],
  };

  if (!organizationId) {
    res.json(empty);
    return;
  }

  // Fetch scoped donations and all constituents concurrently; grants are scoped similarly.
  const [ytdDonations, totalDonors, newDonorsYtd, activeCampaigns, ytdGrants] = await Promise.all([
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        ...(donationDateFilter ? { date: donationDateFilter } : {}),
      },
      select: { amount: true, date: true },
    }),
    prisma.constituent.count({ where: { organizationId } }),
    prisma.constituent.count({
      where: {
        organizationId,
        ...(useAllYears
          ? { firstGiftDate: { not: null } }
          : { firstGiftDate: yearRange }),
      },
    }),
    prisma.campaign.findMany({
      where: {
        organizationId,
        ...(useAllYears ? {} : campaignOverlapRangeFilter(yearRange)),
      },
      select: { goal: true },
    }),
    // Scoped awarded grants — returned separately; UI decides whether to include in totals.
    prisma.grant.aggregate({
      where: {
        organizationId,
        status: "AWARDED",
        ...(grantAwardedAtFilter ? { awardedAt: grantAwardedAtFilter } : {}),
        amountAwarded: { not: null },
      },
      _sum: { amountAwarded: true },
    }),
  ]);

  const ytdRevenue = ytdDonations.reduce((sum, d) => sum + Number(d.amount), 0);
  const ytdGoal = activeCampaigns.reduce((sum, c) => sum + Number(c.goal ?? 0), 0);
  const majorGiftCount = ytdDonations.filter((d) => Number(d.amount) >= 1000).length;
  const averageGift = ytdDonations.length > 0 ? ytdRevenue / ytdDonations.length : 0;

  // Full cohort retention using the shared helper
  const lastYearRange = getYearRange(year - 1);
  const [lastYearDonorIds, thisYearDonorIds] = await Promise.all([
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: lastYearRange,
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: getYearRange(year),
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  const lastYearSet = new Set(lastYearDonorIds.map((d) => d.constituentId));
  const thisYearSet = new Set(thisYearDonorIds.map((d) => d.constituentId));
  const retained = [...lastYearSet].filter((id) => thisYearSet.has(id)).length;
  const donorRetentionRate = calcRetentionRate(retained, lastYearSet.size);

  // Build monthly trend: sum donations for each month Jan–current
  const now = new Date();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMap: Record<number, number> = {};
  for (const d of ytdDonations) {
    const m = new Date(d.date).getMonth();
    trendMap[m] = (trendMap[m] ?? 0) + Number(d.amount);
  }
  const monthsToShow = useAllYears ? 12 : (year === now.getFullYear() ? now.getMonth() + 1 : 12);
  const monthlyTrend = MONTHS.slice(0, monthsToShow).map((label, i) => ({
    label,
    amount: Math.round(trendMap[i] ?? 0),
  }));

  res.json({
    summary: {
      ytdRevenue: Math.round(ytdRevenue),
      ytdGoal: Math.round(ytdGoal),
      // ytdGrantRevenue is always returned so the board view can optionally surface it
      ytdGrantRevenue: Math.round(Number(ytdGrants._sum.amountAwarded ?? 0)),
      donorRetentionRate,
      totalDonors,
      newDonorsYtd,
      totalGiftsYtd: ytdDonations.length,
      averageGift: Math.round(averageGift),
      majorGiftCount,
    },
    monthlyTrend,
  });
});

/**
 * GET /api/reports/lybunt
 * LYBUNT: Donors who gave last year but NOT this year.
 * Returns up to 100 constituents ordered by lastGiftAmount desc.
 */
router.get("/lybunt", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { year: thisYear } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const lastYear = thisYear - 1;

  // Fetch distinct constituent IDs from both years in parallel
  const [lastYearDonors, thisYearDonors] = await Promise.all([
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: getYearRange(lastYear), constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: getYearRange(thisYear), constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  // Set-difference in JS: gave last year AND NOT this year
  const thisYearSet = new Set(thisYearDonors.map((d) => d.constituentId));
  const lybuntIds = lastYearDonors
    .filter((d) => !thisYearSet.has(d.constituentId))
    .map((d) => d.constituentId);

  if (lybuntIds.length === 0) {
    res.json([]);
    return;
  }

  const donors = await prisma.constituent.findMany({
    where: { id: { in: lybuntIds } },
    orderBy: { lastGiftAmount: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      donorStatus: true,
    },
  });

  res.json(donors);
});

/**
 * GET /api/reports/sybunt
 * SYBUNT: Donors who gave before last year but NOT last year or this year.
 * Returns up to 100 constituents ordered by lastGiftAmount desc.
 */
router.get("/sybunt", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { year: thisYear } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const lastYear = thisYear - 1;
  const lastYearRange = getYearRange(lastYear);
  const thisYearRange = getYearRange(thisYear);

  // Fetch donors who gave before lastYear, in lastYear, and in thisYear
  const [beforeLastYear, lastYearDonors, thisYearDonors] = await Promise.all([
    // Anyone who gave before lastYear (the SYBUNT pool)
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { lt: lastYearRange.gte }, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    // Exclude those who gave in lastYear
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: lastYearRange, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    // Exclude those who gave in thisYear
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: thisYearRange, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  // Set difference: gave before lastYear AND not in lastYear AND not in thisYear
  const excludeSet = new Set([
    ...lastYearDonors.map((d) => d.constituentId),
    ...thisYearDonors.map((d) => d.constituentId),
  ]);
  const sybuntIds = beforeLastYear
    .filter((d) => !excludeSet.has(d.constituentId))
    .map((d) => d.constituentId);

  if (sybuntIds.length === 0) {
    res.json([]);
    return;
  }

  const donors = await prisma.constituent.findMany({
    where: { id: { in: sybuntIds } },
    orderBy: { lastGiftAmount: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      donorStatus: true,
    },
  });

  res.json(donors);
});

/**
 * GET /api/reports/year-comparison?year=YYYY
 * Month-by-month revenue comparison: thisYear vs lastYear.
 * Returns 12 objects { month, thisYear, lastYear }.
 */
router.get("/year-comparison", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, thisYear: 0, lastYear: 0 })));
    return;
  }

  const yearParam = String(req.query.year ?? new Date().getFullYear());
  const thisYear = parseInt(yearParam, 10);
  const lastYear = thisYear - 1;

  const [thisYearDonations, lastYearDonations] = await Promise.all([
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: getYearRange(thisYear), constituent: { organizationId } },
      select: { date: true, amount: true },
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: getYearRange(lastYear), constituent: { organizationId } },
      select: { date: true, amount: true },
    }),
  ]);

  // Aggregate by month in application code to stay DB-agnostic
  const thisYearByMonth: Record<number, number> = {};
  const lastYearByMonth: Record<number, number> = {};

  thisYearDonations.forEach((d) => {
    const m = new Date(d.date).getMonth() + 1;
    thisYearByMonth[m] = (thisYearByMonth[m] ?? 0) + Number(d.amount);
  });
  lastYearDonations.forEach((d) => {
    const m = new Date(d.date).getMonth() + 1;
    lastYearByMonth[m] = (lastYearByMonth[m] ?? 0) + Number(d.amount);
  });

  const result = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    thisYear: Math.round((thisYearByMonth[i + 1] ?? 0) * 100) / 100,
    lastYear: Math.round((lastYearByMonth[i + 1] ?? 0) * 100) / 100,
  }));

  res.json(result);
});

/**
 * GET /api/reports/campaign-performance
 * Stats for all campaigns in the org (raised, giftCount, uniqueDonors, avgGift).
 * Aggregated in JS to stay DB-agnostic. Ordered by raised desc.
 */
router.get("/campaign-performance", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { useAllYears, yearRange, donationDateFilter } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId,
      ...(useAllYears ? {} : campaignOverlapRangeFilter(yearRange)),
    },
    include: {
      donations: {
        where: {
          status: "COMPLETED",
          ...(donationDateFilter ? { date: donationDateFilter } : {}),
        },
        select: { amount: true, constituentId: true },
      },
    },
  });

  const result = campaigns
    .map((c) => {
      const raised = c.donations.reduce((sum, d) => sum + Number(d.amount), 0);
      const giftCount = c.donations.length;
      const uniqueDonors = new Set(c.donations.map((d) => d.constituentId)).size;
      const avgGift = giftCount > 0 ? raised / giftCount : 0;
      return {
        id: c.id,
        name: c.name,
        goal: c.goal != null ? Number(c.goal) : null,
        active: c.active,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate?.toISOString() ?? null,
        raised: Math.round(raised * 100) / 100,
        giftCount,
        uniqueDonors,
        avgGift: Math.round(avgGift * 100) / 100,
      };
    })
    .sort((a, b) => b.raised - a.raised);

  res.json(result);
});

/**
 * GET /api/reports/giving-by-tier
 * Breakdown of current-year COMPLETED gifts into:
 *   micro (<$50), small ($50–$249.99), mid ($250–$999.99), major ($1000+)
 * Returns counts and totals per tier.
 */
router.get("/giving-by-tier", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { donationDateFilter } = await parseReportScope(req.query, organizationId);
  const empty = { micro: { count: 0, amount: 0 }, small: { count: 0, amount: 0 }, mid: { count: 0, amount: 0 }, major: { count: 0, amount: 0 } };
  if (!organizationId) {
    res.json(empty);
    return;
  }

  const donations = await prisma.donation.findMany({
    where: {
      status: "COMPLETED",
      ...(donationDateFilter ? { date: donationDateFilter } : {}),
      constituent: { organizationId },
    },
    select: { amount: true },
  });

  const tiers = { micro: { count: 0, amount: 0 }, small: { count: 0, amount: 0 }, mid: { count: 0, amount: 0 }, major: { count: 0, amount: 0 } };

  donations.forEach((d) => {
    const amt = Number(d.amount);
    if (amt < 50) {
      tiers.micro.count++;
      tiers.micro.amount += amt;
    } else if (amt < 250) {
      tiers.small.count++;
      tiers.small.amount += amt;
    } else if (amt < 1000) {
      tiers.mid.count++;
      tiers.mid.amount += amt;
    } else {
      tiers.major.count++;
      tiers.major.amount += amt;
    }
  });

  // Round amounts to 2 dp
  tiers.micro.amount = Math.round(tiers.micro.amount * 100) / 100;
  tiers.small.amount = Math.round(tiers.small.amount * 100) / 100;
  tiers.mid.amount = Math.round(tiers.mid.amount * 100) / 100;
  tiers.major.amount = Math.round(tiers.major.amount * 100) / 100;

  res.json(tiers);
});

/**
 * GET /api/reports/payment-breakdown
 * Count and total amount of current-year COMPLETED donations by paymentMethod.
 * Returns array of { paymentMethod, count, amount } ordered by amount desc.
 */
router.get("/payment-breakdown", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { donationDateFilter } = await parseReportScope(req.query, organizationId);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const donations = await prisma.donation.findMany({
    where: {
      status: "COMPLETED",
      ...(donationDateFilter ? { date: donationDateFilter } : {}),
      constituent: { organizationId },
    },
    select: { paymentMethod: true, amount: true },
  });

  // Aggregate by paymentMethod in JS
  const breakdown: Record<string, { count: number; amount: number }> = {};
  donations.forEach((d) => {
    const m = d.paymentMethod;
    if (!breakdown[m]) breakdown[m] = { count: 0, amount: 0 };
    breakdown[m].count++;
    breakdown[m].amount += Number(d.amount);
  });

  const result = Object.entries(breakdown)
    .map(([paymentMethod, { count, amount }]) => ({
      paymentMethod,
      count,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  res.json(result);
});

/**
 * GET /api/reports/donor-segments
 * Count of constituents grouped by donorStatus for the org.
 * Returns { ACTIVE, LAPSED, NEW, MAJOR_DONOR, PROSPECT, DECEASED, OTHER }.
 */
router.get("/donor-segments", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ ACTIVE: 0, LAPSED: 0, NEW: 0, MAJOR_DONOR: 0, PROSPECT: 0, DECEASED: 0, OTHER: 0 });
    return;
  }

  const groups = await prisma.constituent.groupBy({
    by: ["donorStatus"],
    where: { organizationId },
    _count: { id: true },
  });

  // Build result with defaults for every possible status value
  const result: Record<string, number> = {
    ACTIVE: 0,
    LAPSED: 0,
    NEW: 0,
    MAJOR_DONOR: 0,
    PROSPECT: 0,
    DECEASED: 0,
    OTHER: 0,
  };
  groups.forEach((g) => {
    result[g.donorStatus] = g._count.id;
  });

  res.json(result);
});

/**
 * GET /api/reports/new-vs-returning?year=YYYY
 * Month-by-month: new donors (firstGiftDate in that month) vs returning donors
 * (donated that month AND firstGiftDate before the start of that year).
 * Returns 12 objects { month, newCount, returningCount }.
 */
router.get("/new-vs-returning", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, newCount: 0, returningCount: 0 })));
    return;
  }

  const yearParam = String(req.query.year ?? new Date().getFullYear());
  const year = parseInt(yearParam, 10);
  const yearRange = getYearRange(year);
  const yearStart = yearRange.gte;

  // Fetch new donors (firstGiftDate in this year) and all donations this year in parallel
  const [newDonors, donations] = await Promise.all([
    prisma.constituent.findMany({
      where: { organizationId, firstGiftDate: yearRange },
      select: { id: true, firstGiftDate: true },
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: yearRange, constituent: { organizationId } },
      select: { constituentId: true, date: true, constituent: { select: { firstGiftDate: true } } },
    }),
  ]);

  // Aggregate new donors per month
  const newByMonth: Record<number, Set<string>> = {};
  for (const c of newDonors) {
    if (c.firstGiftDate) {
      const m = new Date(c.firstGiftDate).getMonth() + 1;
      if (!newByMonth[m]) newByMonth[m] = new Set();
      newByMonth[m].add(c.id);
    }
  }

  // Aggregate returning donors per month: gave this year AND firstGiftDate before yearStart
  const returningByMonth: Record<number, Set<string>> = {};
  for (const d of donations) {
    const firstGift = d.constituent.firstGiftDate;
    if (firstGift && new Date(firstGift) < yearStart) {
      const m = new Date(d.date).getMonth() + 1;
      if (!returningByMonth[m]) returningByMonth[m] = new Set();
      returningByMonth[m].add(d.constituentId);
    }
  }

  const result = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    newCount: newByMonth[i + 1]?.size ?? 0,
    returningCount: returningByMonth[i + 1]?.size ?? 0,
  }));

  res.json(result);
});

/**
 * GET /api/reports/admin-summary?year=YYYY&scope=ALL_YEARS
 * Cross-module operational reporting for administrators.
 * Includes donor + compassion counts, data quality alerts, and monthly trend lines.
 */
router.get("/admin-summary", async (req, res) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can access administrative reports." } });
    return;
  }

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { year, useAllYears, yearRange, donationDateFilter } = await parseReportScope(req.query, organizationId);
  const strictYearRange = getYearRange(year);

  const [
    totalConstituents,
    activeDonors,
    lapsedDonors,
    majorDonors,
    newDonorsThisYear,
    donorMissingContact,
    totalClients,
    activeClients,
    pendingClients,
    inactiveClients,
    archivedClients,
    unassignedClients,
    openCases,
    closedCasesThisYear,
    appointmentsScheduled,
    appointmentsCompleted,
    clientMissingContact,
    linkedClients,
  ] = await Promise.all([
    prisma.constituent.count({ where: { organizationId } }),
    prisma.constituent.count({ where: { organizationId, donorStatus: "ACTIVE" } }),
    prisma.constituent.count({ where: { organizationId, donorStatus: "LAPSED" } }),
    prisma.constituent.count({ where: { organizationId, donorStatus: "MAJOR_DONOR" } }),
    prisma.constituent.count({ where: { organizationId, createdAt: yearRange } }),
    prisma.constituent.count({ where: { organizationId, OR: [{ email: null }, { phone: null }] } }),
    prisma.compassionClient.count({ where: { organizationId } }),
    prisma.compassionClient.count({ where: { organizationId, clientStatus: "ACTIVE" } }),
    prisma.compassionClient.count({ where: { organizationId, clientStatus: "PENDING" } }),
    prisma.compassionClient.count({ where: { organizationId, clientStatus: "INACTIVE" } }),
    prisma.compassionClient.count({ where: { organizationId, clientStatus: "ARCHIVED" } }),
    prisma.compassionClient.count({ where: { organizationId, assignedStaffId: null, assignedCompassionStaffId: null } }),
    prisma.compassionCase.count({ where: { organizationId, caseStatus: { in: ["OPEN", "IN_PROGRESS", "PENDING"] } } }),
    prisma.compassionCase.count({ where: { organizationId, caseStatus: "CLOSED", closedAt: strictYearRange } }),
    prisma.compassionAppointment.count({ where: { organizationId, status: "SCHEDULED" } }),
    prisma.compassionAppointment.count({ where: { organizationId, status: "COMPLETED", startTime: useAllYears ? undefined : yearRange } }),
    prisma.compassionClient.count({ where: { organizationId, OR: [{ email: null }, { phone: null }] } }),
    prisma.compassionClient.count({ where: { organizationId, constituentId: { not: null } } }),
  ]);

  const [donationRows, donorEmailRows, clientEmailRows, linkedConstituentRows, donorRiskCandidates, clientRiskCandidates] = await Promise.all([
    prisma.donation.findMany({
      where: completedDonationWhere(organizationId, donationDateFilter),
      select: { amount: true, date: true },
    }),
    prisma.constituent.findMany({
      where: { organizationId, email: { not: null } },
      select: { email: true },
    }),
    prisma.compassionClient.findMany({
      where: { organizationId, email: { not: null } },
      select: { email: true },
    }),
    prisma.compassionClient.findMany({
      where: { organizationId, constituentId: { not: null } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.constituent.findMany({
      where: {
        organizationId,
        OR: [
          { email: null },
          { phone: null },
          { donorStatus: "LAPSED" },
        ],
      },
      orderBy: [{ totalLifetimeGiving: "desc" }, { updatedAt: "desc" }],
      take: 120,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        donorStatus: true,
        totalLifetimeGiving: true,
        lastGiftDate: true,
      },
    }),
    prisma.compassionClient.findMany({
      where: {
        organizationId,
        OR: [
          { email: null },
          { phone: null },
          { clientStatus: { in: ["INACTIVE", "PENDING"] } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clientStatus: true,
        intakeDate: true,
      },
    }),
  ]);

  const donorEmailCounts = new Map<string, number>();
  donorEmailRows.forEach(({ email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    donorEmailCounts.set(normalized, (donorEmailCounts.get(normalized) ?? 0) + 1);
  });
  const donorDuplicateEmails = new Set(
    Array.from(donorEmailCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([email]) => email),
  );

  const clientEmailCounts = new Map<string, number>();
  clientEmailRows.forEach(({ email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    clientEmailCounts.set(normalized, (clientEmailCounts.get(normalized) ?? 0) + 1);
  });
  const clientDuplicateEmails = new Set(
    Array.from(clientEmailCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([email]) => email),
  );

  const totalGiftVolume = donationRows.reduce((sum, donation) => sum + Number(donation.amount ?? 0), 0);
  const averageGift = donationRows.length > 0 ? totalGiftVolume / donationRows.length : 0;

  const trendStart = new Date(year, 0, 1);
  const trendEnd = new Date(year + 1, 0, 1);
  const [constituentTrendRows, clientTrendRows, donationTrendRows, caseTrendRows, appointmentTrendRows] = await Promise.all([
    prisma.constituent.findMany({
      where: { organizationId, createdAt: { gte: trendStart, lt: trendEnd } },
      select: { createdAt: true },
    }),
    prisma.compassionClient.findMany({
      where: { organizationId, intakeDate: { gte: trendStart, lt: trendEnd } },
      select: { intakeDate: true },
    }),
    prisma.donation.findMany({
      where: completedDonationWhere(organizationId, { gte: trendStart, lt: trendEnd }),
      select: { date: true, amount: true },
    }),
    prisma.compassionCase.findMany({
      where: { organizationId, openedAt: { gte: trendStart, lt: trendEnd } },
      select: { openedAt: true },
    }),
    prisma.compassionAppointment.findMany({
      where: { organizationId, status: "COMPLETED", startTime: { gte: trendStart, lt: trendEnd } },
      select: { startTime: true },
    }),
  ]);

  const monthlyTrend = Array.from({ length: 12 }, (_, monthIndex) => ({
    month: monthIndex + 1,
    label: new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "short" }),
    newConstituents: 0,
    newClients: 0,
    donations: 0,
    casesOpened: 0,
    appointmentsCompleted: 0,
  }));

  constituentTrendRows.forEach((row) => {
    const month = row.createdAt.getMonth();
    monthlyTrend[month].newConstituents += 1;
  });
  clientTrendRows.forEach((row) => {
    const month = row.intakeDate.getMonth();
    monthlyTrend[month].newClients += 1;
  });
  donationTrendRows.forEach((row) => {
    const month = row.date.getMonth();
    monthlyTrend[month].donations += Number(row.amount ?? 0);
  });
  caseTrendRows.forEach((row) => {
    const month = row.openedAt.getMonth();
    monthlyTrend[month].casesOpened += 1;
  });
  appointmentTrendRows.forEach((row) => {
    const month = row.startTime.getMonth();
    monthlyTrend[month].appointmentsCompleted += 1;
  });

  const donorRiskRows = donorRiskCandidates.map((row) => {
    const normalized = normalizeEmail(row.email);
    const fullName = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unknown donor";
    const missingContact = !row.email || !row.phone;
    const duplicateEmail = normalized ? donorDuplicateEmails.has(normalized) : false;

    return {
      kind: "donor" as const,
      id: row.id,
      name: fullName,
      email: row.email,
      status: row.donorStatus,
      missingContact,
      duplicateEmail,
      valueAmount: Number(row.totalLifetimeGiving ?? 0),
      lastActivity: row.lastGiftDate ? row.lastGiftDate.toISOString() : null,
      notes: row.donorStatus === "LAPSED" ? "Lapsed donor follow-up needed" : "Review donor profile",
    };
  });

  const clientRiskRows = clientRiskCandidates.map((row) => {
    const normalized = normalizeEmail(row.email);
    const fullName = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "Unknown client";
    const missingContact = !row.email || !row.phone;
    const duplicateEmail = normalized ? clientDuplicateEmails.has(normalized) : false;

    return {
      kind: "client" as const,
      id: row.id,
      name: fullName,
      email: row.email,
      status: row.clientStatus,
      missingContact,
      duplicateEmail,
      valueAmount: 0,
      lastActivity: row.intakeDate ? row.intakeDate.toISOString() : null,
      notes: row.clientStatus === "PENDING" ? "Pending intake review" : "Client case attention recommended",
    };
  });

  const alerts = [
    {
      id: "donor-missing-contact",
      level: donorMissingContact > 40 ? "critical" : donorMissingContact > 15 ? "warning" : "info",
      title: "Donor records missing contact",
      value: donorMissingContact.toLocaleString(),
      detail: "Donor records without both core contact channels slow stewardship follow-up.",
    },
    {
      id: "client-missing-contact",
      level: clientMissingContact > 30 ? "critical" : clientMissingContact > 10 ? "warning" : "info",
      title: "Client records missing contact",
      value: clientMissingContact.toLocaleString(),
      detail: "Compassion client records with missing contact details reduce appointment reliability.",
    },
    {
      id: "duplicate-emails",
      level: donorDuplicateEmails.size + clientDuplicateEmails.size > 25 ? "warning" : "info",
      title: "Duplicate email clusters",
      value: (donorDuplicateEmails.size + clientDuplicateEmails.size).toLocaleString(),
      detail: "Duplicate emails across records increase merge and communication error risk.",
    },
    {
      id: "unlinked-client-profiles",
      level: totalClients - linkedClients > 150 ? "warning" : "info",
      title: "Unlinked compassion profiles",
      value: Math.max(0, totalClients - linkedClients).toLocaleString(),
      detail: "Review shared-person links where donor-client relationships should be intentionally connected.",
    },
  ];

  res.json({
    generatedAt: new Date().toISOString(),
    year,
    donorTotals: {
      totalConstituents,
      activeDonors,
      lapsedDonors,
      majorDonors,
      newDonorsThisYear,
      missingContact: donorMissingContact,
      duplicateEmailCount: donorDuplicateEmails.size,
      totalGiftVolume,
      averageGift,
    },
    compassionTotals: {
      totalClients,
      activeClients,
      pendingClients,
      inactiveClients,
      archivedClients,
      unassignedClients,
      openCases,
      closedCasesThisYear,
      appointmentsScheduled,
      appointmentsCompleted,
      missingContact: clientMissingContact,
      duplicateEmailCount: clientDuplicateEmails.size,
    },
    linkage: {
      linkedClients,
      unlinkedClients: Math.max(0, totalClients - linkedClients),
      linkedConstituents: linkedConstituentRows.length,
    },
    monthlyTrend,
    alerts,
    riskRows: [...donorRiskRows, ...clientRiskRows].slice(0, 220),
  });
});



/**
 * GET /api/reports/recent-donations?limit=N
 * Last N completed donations with constituent name, amount, date, campaign.
 * Used by the dashboard Recent Donations widget. Default limit = 8.
 */
router.get("/recent-donations", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }
  const { donationDateFilter } = await parseReportScope(req.query, organizationId);

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "8", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 5000) : 8;
  const now = new Date();
  const dateFilter = mergeDateFilters(donationDateFilter, { lte: now });

  const donations = await prisma.donation.findMany({
    where: completedDonationWhere(organizationId, dateFilter),
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      amount: true,
      date: true,
      paymentMethod: true,
      constituent: { select: { id: true, firstName: true, lastName: true } },
      campaign: { select: { name: true } },
    },
  });

  res.json(donations.map((d) => ({
    id: d.id,
    amount: Number(d.amount),
    date: d.date,
    paymentMethod: d.paymentMethod,
    constituentId: d.constituent.id,
    constituentName: `${d.constituent.firstName} ${d.constituent.lastName}`.trim(),
    campaignName: d.campaign?.name ?? null,
  })));
});
export default router;
