import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/reports/summary - high-level org stats
router.get("/summary", async (_req, res) => {
  const [
    totalConstituents,
    totalDonations,
    activeCampaigns,
    pendingTasks,
  ] = await Promise.all([
    prisma.constituent.count(),
    prisma.donation.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.campaign.count({ where: { active: true } }),
    prisma.task.count({ where: { status: "PENDING" } }),
  ]);

  res.json({
    totalConstituents,
    totalDonationsAmount: totalDonations._sum.amount ?? 0,
    totalDonationsCount: totalDonations._count,
    activeCampaigns,
    pendingTasks,
  });
});

// GET /api/reports/giving-by-month
router.get("/giving-by-month", async (req, res) => {
  const { year = new Date().getFullYear().toString() } = req.query as Record<string, string>;
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31`);

  const donations = await prisma.donation.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: { date: true, amount: true },
  });

  // Group by month
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

export default router;
