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
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    totalConstituents,
    ytdDonations,
    weekDonations,
    activeCampaigns,
    pendingTasks,
    overdueTasks,
    activeCampaignGoal,
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
    prisma.campaign.count({ where: { organizationId, active: true } }),
    prisma.task.count({ where: { status: "PENDING", ...taskOrganizationWhere(organizationId) } }),
    prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now }, ...taskOrganizationWhere(organizationId) } }),
    // Sum of goals across active campaigns for progress tracking
    prisma.campaign.aggregate({
      where: { organizationId, active: true, goal: { not: null } },
      _sum: { goal: true },
    }),
  ]);

  const weekAmt = Number(weekDonations._sum.amount ?? 0);
  const weekCount = weekDonations._count;

  res.json({
    totalConstituents,
    ytdAmount: Number(ytdDonations._sum.amount ?? 0),
    ytdCount: ytdDonations._count,
    weekAmount: weekAmt,
    weekCount,
    weekAvg: weekCount > 0 ? weekAmt / weekCount : 0,
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

export default router;
