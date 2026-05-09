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

/**
 * GET /api/reports/summary — Return high-level org-wide KPIs for the dashboard header cards.
 * Runs all aggregation queries concurrently to minimise response latency.
 */
router.get("/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalConstituents: 0,
      ytdAmount: 0,
      ytdCount: 0,
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
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

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
    newDonorsThisMonth,
  ] = await Promise.all([
    prisma.constituent.count({ where: { organizationId } }),
    // YTD completed donations — sum and count since Jan 1 of the current year
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfYear }, constituent: { organizationId } },
      _sum: { amount: true },
      _count: true,
    }),
    // This week's donations
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfWeek }, constituent: { organizationId } },
      _sum: { amount: true },
      _count: true,
    }),
    // This month's donations (for trend comparison)
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfMonth }, constituent: { organizationId } },
      _sum: { amount: true },
      _count: true,
    }),
    // Last month's donations (for MoM trend)
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfLastMonth, lte: endOfLastMonth }, constituent: { organizationId } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.campaign.count({ where: { organizationId, active: true } }),
    prisma.task.count({ where: { status: "PENDING", ...taskOrganizationWhere(organizationId) } }),
    prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now }, ...taskOrganizationWhere(organizationId) } }),
    // Sum of goals across active campaigns for progress tracking
    prisma.campaign.aggregate({
      where: { organizationId, active: true, goal: { not: null } },
      _sum: { goal: true },
    }),
    // Constituents whose first recorded gift is this month (new donors)
    prisma.constituent.count({
      where: { organizationId, firstGiftDate: { gte: startOfMonth } },
    }),
  ]);

  const weekAmt = Number(weekDonations._sum.amount ?? 0);
  const weekCount = weekDonations._count;
  const monthAmt = Number(monthDonations._sum.amount ?? 0);
  const lastMonthAmt = Number(lastMonthDonations._sum.amount ?? 0);
  // Month-over-month trend: positive = up, negative = down
  const momTrend = lastMonthAmt > 0 ? Math.round(((monthAmt - lastMonthAmt) / lastMonthAmt) * 100) : null;

  res.json({
    totalConstituents,
    ytdAmount: Number(ytdDonations._sum.amount ?? 0),
    ytdCount: ytdDonations._count,
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
 * Returns an array of 12 objects `{ month: 1-12, amount: number }`.
 */
router.get("/giving-by-month", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json(Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 })));
    return;
  }

  const { year = new Date().getFullYear().toString() } = req.query as Record<string, string>;
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  const donations = await prisma.donation.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "COMPLETED",
      constituent: { organizationId },
    },
    select: { date: true, amount: true },
  });

  // Aggregate by month number 1–12 in application code (avoids SQL MONTH() dialect differences)
  const byMonth: Record<number, number> = {};
  donations.forEach((d) => {
    const month = new Date(d.date).getMonth() + 1;
    byMonth[month] = (byMonth[month] ?? 0) + Number(d.amount);
  });

  const result = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    amount: byMonth[i + 1] ?? 0,
  }));

  res.json(result);
});

/**
 * GET /api/reports/donor-retention — Compute year-over-year donor retention rate.
 * Formula: (donors who gave in both lastYear AND thisYear) / (donors who gave in lastYear) × 100.
 */
router.get("/donor-retention", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ total: 0, retained: 0, rate: 0, year: new Date().getFullYear() });
    return;
  }

  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;

  const [lastYearDonors, thisYearDonors] = await Promise.all([
    // Unique constituent IDs who donated last year (base cohort for retention rate)
    prisma.donation.findMany({
      where: {
        status: "COMPLETED",
        date: { gte: new Date(`${lastYear}-01-01`), lte: new Date(`${lastYear}-12-31`) },
        constituent: { organizationId },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: {
        status: "COMPLETED",
        date: { gte: new Date(`${thisYear}-01-01`), lte: new Date(`${thisYear}-12-31`) },
        constituent: { organizationId },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  const total = lastYearDonors.length;
  const thisYearSet = new Set(thisYearDonors.map((donor) => donor.constituentId));
  const retained = lastYearDonors.filter((donor) => thisYearSet.has(donor.constituentId)).length;
  const rate = total > 0 ? Math.round((retained / total) * 100) : 0;

  res.json({ total, retained, rate, year: thisYear });
});

/**
 * GET /api/reports/top-donors?limit=N — Top N constituents by total lifetime giving amount.
 * Defaults to top 10. Only includes constituents with at least one recorded gift.
 */
router.get("/top-donors", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const limit = parseInt((req.query.limit as string) ?? "10");

  const donors = await prisma.constituent.findMany({
    where: { organizationId, totalLifetimeGiving: { gt: 0 } },
    orderBy: { totalLifetimeGiving: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      totalLifetimeGiving: true,
      lastGiftDate: true,
      donorStatus: true,
    },
  });

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
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);

  // Fetch all YTD donations and all constituents concurrently
  const [ytdDonations, totalDonors, newDonorsYtd, activeCampaigns] = await Promise.all([
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: startOfYear },
      },
      select: { amount: true, date: true },
    }),
    prisma.constituent.count({ where: { organizationId } }),
    prisma.constituent.count({
      where: { organizationId, firstGiftDate: { gte: startOfYear } },
    }),
    prisma.campaign.findMany({
      where: { organizationId, active: true },
      select: { goal: true },
    }),
  ]);

  const ytdRevenue = ytdDonations.reduce((sum, d) => sum + Number(d.amount), 0);
  const ytdGoal = activeCampaigns.reduce((sum, c) => sum + Number(c.goal ?? 0), 0);
  const majorGiftCount = ytdDonations.filter((d) => Number(d.amount) >= 1000).length;
  const averageGift = ytdDonations.length > 0 ? ytdRevenue / ytdDonations.length : 0;

  // Simple retention: if prior-year donors count > 0, use placeholder retention logic
  // A full cohort analysis requires a more expensive query — simplified here for the board view.
  const lastYearStart = new Date(year - 1, 0, 1);
  const lastYearEnd = new Date(year, 0, 1);
  const [lastYearDonorIds, thisYearDonorIds] = await Promise.all([
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: lastYearStart, lt: lastYearEnd },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: startOfYear },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  const lastYearSet = new Set(lastYearDonorIds.map((d) => d.constituentId));
  const thisYearSet = new Set(thisYearDonorIds.map((d) => d.constituentId));
  const retained = [...lastYearSet].filter((id) => thisYearSet.has(id)).length;
  const donorRetentionRate =
    lastYearSet.size > 0 ? Math.round((retained / lastYearSet.size) * 100) : 0;

  // Build monthly trend: sum donations for each month Jan–current
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMap: Record<number, number> = {};
  for (const d of ytdDonations) {
    const m = new Date(d.date).getMonth();
    trendMap[m] = (trendMap[m] ?? 0) + Number(d.amount);
  }
  const monthlyTrend = MONTHS.slice(0, now.getMonth() + 1).map((label, i) => ({
    label,
    amount: Math.round(trendMap[i] ?? 0),
  }));

  res.json({
    summary: {
      ytdRevenue: Math.round(ytdRevenue),
      ytdGoal: Math.round(ytdGoal),
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
  if (!organizationId) {
    res.json([]);
    return;
  }

  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const lastYearStart = new Date(`${lastYear}-01-01`);
  const lastYearEnd = new Date(`${lastYear}-12-31`);
  const thisYearStart = new Date(`${thisYear}-01-01`);
  const thisYearEnd = new Date(`${thisYear}-12-31`);

  // Fetch distinct constituent IDs from both years in parallel
  const [lastYearDonors, thisYearDonors] = await Promise.all([
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: lastYearStart, lte: lastYearEnd }, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: thisYearStart, lte: thisYearEnd }, constituent: { organizationId } },
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
  if (!organizationId) {
    res.json([]);
    return;
  }

  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const lastYearStart = new Date(`${lastYear}-01-01`);
  const thisYearStart = new Date(`${thisYear}-01-01`);
  const thisYearEnd = new Date(`${thisYear}-12-31`);

  // Fetch donors who gave before lastYear, in lastYear, and in thisYear
  const [beforeLastYear, lastYearDonors, thisYearDonors] = await Promise.all([
    // Anyone who gave before lastYear (the SYBUNT pool)
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { lt: lastYearStart }, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    // Exclude those who gave in lastYear
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: lastYearStart, lt: thisYearStart }, constituent: { organizationId } },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    // Exclude those who gave in thisYear
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: thisYearStart, lte: thisYearEnd }, constituent: { organizationId } },
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
      where: { status: "COMPLETED", date: { gte: new Date(`${thisYear}-01-01`), lte: new Date(`${thisYear}-12-31`) }, constituent: { organizationId } },
      select: { date: true, amount: true },
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: new Date(`${lastYear}-01-01`), lte: new Date(`${lastYear}-12-31`) }, constituent: { organizationId } },
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
  if (!organizationId) {
    res.json([]);
    return;
  }

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    include: {
      donations: {
        where: { status: "COMPLETED" },
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
  const empty = { micro: { count: 0, amount: 0 }, small: { count: 0, amount: 0 }, mid: { count: 0, amount: 0 }, major: { count: 0, amount: 0 } };
  if (!organizationId) {
    res.json(empty);
    return;
  }

  const thisYear = new Date().getFullYear();
  const donations = await prisma.donation.findMany({
    where: {
      status: "COMPLETED",
      date: { gte: new Date(`${thisYear}-01-01`), lte: new Date(`${thisYear}-12-31`) },
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
  if (!organizationId) {
    res.json([]);
    return;
  }

  const thisYear = new Date().getFullYear();
  const donations = await prisma.donation.findMany({
    where: {
      status: "COMPLETED",
      date: { gte: new Date(`${thisYear}-01-01`), lte: new Date(`${thisYear}-12-31`) },
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
  const yearStart = new Date(`${year}-01-01`);
  const yearEnd = new Date(`${year}-12-31`);

  // Fetch new donors (firstGiftDate in this year) and all donations this year in parallel
  const [newDonors, donations] = await Promise.all([
    prisma.constituent.findMany({
      where: { organizationId, firstGiftDate: { gte: yearStart, lte: yearEnd } },
      select: { id: true, firstGiftDate: true },
    }),
    prisma.donation.findMany({
      where: { status: "COMPLETED", date: { gte: yearStart, lte: yearEnd }, constituent: { organizationId } },
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

  const donations = await prisma.donation.findMany({
    where: { status: "COMPLETED", constituent: { organizationId } },
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
