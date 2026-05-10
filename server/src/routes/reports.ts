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
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { completedDonationWhere } from "../lib/donationScope.js";
import {
  getYearRange,
  getStartOfWeek,
  calcRetentionRate,
  calcYoYPercent,
} from "../lib/dateRanges.js";

const router = Router();

// All report routes require authentication — report data is sensitive org information.
router.use(requireAuth);

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

/** Parses report scope from query params and returns year + optional date range filters. */
function parseReportScope(rawQuery: unknown) {
  const query = (rawQuery ?? {}) as Record<string, string | string[] | undefined>;
  const yearQuery = Array.isArray(query.year) ? query.year[0] : query.year;
  const scopeQuery = Array.isArray(query.scope) ? query.scope[0] : query.scope;
  const currentYear = new Date().getFullYear();
  const parsedYear = Number.parseInt(yearQuery ?? String(currentYear), 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : currentYear;
  const useAllYears = scopeQuery?.toUpperCase() === "ALL_YEARS";
  const yearRange = getYearRange(year);
  const now = new Date();
  // For the active calendar year, use true YTD (Jan 1 -> now) so dashboard values match YTD date pickers.
  const ytdRange = { gte: new Date(year, 0, 1), lte: now };
  const scopedRange = year === currentYear ? ytdRange : yearRange;

  return {
    year,
    useAllYears,
    yearRange: scopedRange,
    donationDateFilter: useAllYears ? undefined : scopedRange,
    grantAwardedAtFilter: useAllYears ? undefined : scopedRange,
  };
}

/** Returns campaigns that overlap a target calendar year. */
function campaignOverlapYearFilter(year: number) {
  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);

  return {
    AND: [
      { startDate: { lt: nextYearStart } },
      {
        OR: [
          { endDate: null },
          { endDate: { gte: yearStart } },
        ],
      },
    ],
  };
}

/**
 * GET /api/reports/summary — Return high-level org-wide KPIs for the dashboard header cards.
 * Runs all aggregation queries concurrently to minimise response latency.
 */
router.get("/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const { year, useAllYears, donationDateFilter, grantAwardedAtFilter } = parseReportScope(req.query);
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
    });
    return;
  }

  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
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
        ...(useAllYears ? {} : campaignOverlapYearFilter(year)),
      },
    }),
    prisma.task.count({ where: { status: "PENDING", ...taskOrganizationWhere(organizationId) } }),
    prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now }, ...taskOrganizationWhere(organizationId) } }),
    // Sum of goals across campaigns in the selected scope
    prisma.campaign.aggregate({
      where: {
        organizationId,
        goal: { not: null },
        ...(useAllYears ? {} : campaignOverlapYearFilter(year)),
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
            ...(useAllYears ? {} : campaignOverlapYearFilter(year)),
          },
        },
      },
      _sum: { amount: true },
    }),
    // Constituents whose first recorded gift is in the selected year.
    prisma.constituent.count({
      where: { organizationId, ...(useAllYears ? {} : { firstGiftDate: { gte: startOfYear, lt: new Date(year + 1, 0, 1) } }) },
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
  });
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

  const { donationDateFilter, grantAwardedAtFilter } = parseReportScope(req.query);

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
  const { year: thisYear } = parseReportScope(req.query);
  if (!organizationId) {
    res.json({ total: 0, retained: 0, rate: 0, year: thisYear });
    return;
  }

  const lastYear = thisYear - 1;
  const lastYearRange = getYearRange(lastYear);
  const thisYearRange = getYearRange(thisYear);

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
  const { donationDateFilter } = parseReportScope(req.query);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "10", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;

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
  const { year, useAllYears, donationDateFilter, grantAwardedAtFilter } = parseReportScope(req.query);
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

  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);

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
          : { firstGiftDate: { gte: startOfYear, lt: nextYearStart } }),
      },
    }),
    prisma.campaign.findMany({
      where: {
        organizationId,
        ...(useAllYears ? {} : campaignOverlapYearFilter(year)),
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
  const { year: thisYear } = parseReportScope(req.query);
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
  const { year: thisYear } = parseReportScope(req.query);
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
  const { year, useAllYears, donationDateFilter } = parseReportScope(req.query);
  if (!organizationId) {
    res.json([]);
    return;
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId,
      ...(useAllYears ? {} : campaignOverlapYearFilter(year)),
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
  const { donationDateFilter } = parseReportScope(req.query);
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
  const { donationDateFilter } = parseReportScope(req.query);
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
 * GET /api/reports/recent-donations?limit=N
 * Last N completed donations with constituent name, amount, date, campaign.
 * Used by the dashboard Recent Donations widget. Default limit = 8.
 */
router.get("/recent-donations", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }

  const limit = Math.min(50, parseInt((req.query.limit as string) ?? "8"));
  const now = new Date();

  const donations = await prisma.donation.findMany({
    where: { status: "COMPLETED", date: { lte: now }, constituent: { organizationId } },
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
