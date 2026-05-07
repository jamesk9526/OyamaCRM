/**
 * Analytics and reporting routes for OyamaCRM.
 * Provides aggregated dashboard metrics and downloadable report data.
 * All routes are currently scoped to the hard-coded `org_demo` organization.
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
import { prisma } from "../lib/prisma.js";

const router = Router();
const ORG_ID = "org_demo";

/**
 * GET /api/reports/summary — Return high-level org-wide KPIs for the dashboard header cards.
 * Runs all aggregation queries concurrently to minimise response latency.
 */
router.get("/summary", async (_req, res) => {
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
    prisma.constituent.count({ where: { organizationId: ORG_ID } }),
    // YTD completed donations — sum and count since Jan 1 of the current year
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfYear } },
      _sum: { amount: true },
      _count: true,
    }),
    // This week's donations
    prisma.donation.aggregate({
      where: { status: "COMPLETED", date: { gte: startOfWeek } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.campaign.count({ where: { organizationId: ORG_ID, active: true } }),
    prisma.task.count({ where: { status: "PENDING" } }),
    prisma.task.count({ where: { status: "PENDING", dueDate: { lt: now } } }),
    // Sum of goals across active campaigns for progress tracking
    prisma.campaign.aggregate({
      where: { organizationId: ORG_ID, active: true, goal: { not: null } },
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
  const { year = new Date().getFullYear().toString() } = req.query as Record<string, string>;
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  const donations = await prisma.donation.findMany({
    where: { date: { gte: startDate, lte: endDate }, status: "COMPLETED" },
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
 * Uses a raw SQL join query for the intersection set to avoid loading all IDs into memory.
 */
router.get("/donor-retention", async (_req, res) => {
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;

  const [lastYearDonors, retainedDonors] = await Promise.all([
    // Unique constituent IDs who donated last year (base cohort for retention rate)
    prisma.donation.findMany({
      where: {
        status: "COMPLETED",
        date: { gte: new Date(`${lastYear}-01-01`), lte: new Date(`${lastYear}-12-31`) },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    // Unique constituent IDs who donated in both years — raw SQL INNER JOIN for efficiency
    prisma.$queryRaw<{ constituentId: string }[]>`
      SELECT DISTINCT d1.constituentId
      FROM Donation d1
      INNER JOIN Donation d2 ON d1.constituentId = d2.constituentId
      WHERE d1.status = 'COMPLETED'
        AND YEAR(d1.date) = ${lastYear}
        AND d2.status = 'COMPLETED'
        AND YEAR(d2.date) = ${thisYear}
    `,
  ]);

  const total = lastYearDonors.length;
  const retained = retainedDonors.length;
  const rate = total > 0 ? Math.round((retained / total) * 100) : 0;

  res.json({ total, retained, rate, year: thisYear });
});

/**
 * GET /api/reports/top-donors?limit=N — Top N constituents by total lifetime giving amount.
 * Defaults to top 10. Only includes constituents with at least one recorded gift.
 */
router.get("/top-donors", async (req, res) => {
  const limit = parseInt((req.query.limit as string) ?? "10");

  const donors = await prisma.constituent.findMany({
    where: { organizationId: ORG_ID, totalLifetimeGiving: { gt: 0 } },
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

export default router;

