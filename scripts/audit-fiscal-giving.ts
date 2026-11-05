/** Read-only fiscal reconciliation. Run on the CRM host with its existing DB configuration.
 * pnpm exec tsx scripts/audit-fiscal-giving.ts --organization-id ORG_ID --year 2026
 * Outputs aggregate counts/amounts only; never prints donor identity or credentials.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../server/src/lib/prisma.js";
import { completedDonationWhere } from "../server/src/lib/donationScope.js";
import { getFiscalYearRange, calcYoYPercent, calcRetentionRate } from "../server/src/lib/dateRanges.js";
import { donationCalendarRange, getPriorYearComparisonRange } from "../server/src/services/donor-dashboard-metrics.js";
import { moneyToCents, centsToMoney } from "../server/src/lib/money.js";
const arg = (key: string) => process.argv[process.argv.indexOf(key) + 1];
async function main() {
  const organizationId = process.argv.includes("--organization-id") ? arg("--organization-id") : "";
  const year = Number(process.argv.includes("--year") ? arg("--year") : "");
  if (!organizationId || !Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Provide --organization-id ORG_ID --year YYYY. This command only reads records.");
  const result = await prisma.$transaction(async tx => {
    const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId }, select: { fiscalYearStart: true, currency: true } });
    const current = donationCalendarRange(getFiscalYearRange(year, settings.fiscalYearStart));
    const prior = donationCalendarRange(getFiscalYearRange(year - 1, settings.fiscalYearStart));
    const now = new Date();
    const currentThrough = new Date(Math.min(current.lt.getTime() - 1, now.getTime()));
    if (currentThrough < current.gte) throw new Error("Choose a fiscal year that has already started.");
    const allWhere = completedDonationWhere(organizationId);
    const [gifts, firstGifts, aggregate] = await Promise.all([
      tx.donation.findMany({ where: completedDonationWhere(organizationId, { gte: prior.gte, lt: current.lt }), select: { amount: true, date: true, constituentId: true, isRecurring: true }, take: 50001 }),
      tx.donation.groupBy({ by: ["constituentId"], where: allWhere, _min: { date: true } }),
      tx.donation.aggregate({ where: completedDonationWhere(organizationId, { gte: current.gte, lte: currentThrough }), _sum: { amount: true }, _count: true }),
    ]);
    if (gifts.length > 50000) throw new Error("More than 50,000 gifts in the two-year window; use the report library.");
    const currentGifts = gifts.filter(gift => gift.date >= current.gte && gift.date <= currentThrough);
    const priorGifts = gifts.filter(gift => gift.date >= prior.gte && gift.date < prior.lt);
    const currentDonors = new Set(currentGifts.map(gift => gift.constituentId));
    const priorDonors = new Set(priorGifts.map(gift => gift.constituentId));
    const total = (items: typeof gifts) => centsToMoney(items.reduce((sum, gift) => sum + moneyToCents(gift.amount), 0));
    const currentTotal = total(currentGifts), priorTotal = total(priorGifts);
    const comparison = getPriorYearComparisonRange({ gte: current.gte, lte: currentThrough })!;
    const priorElapsed = priorGifts.filter(gift => gift.date <= (comparison.lte as Date));
    const retained = [...priorDonors].filter(id => currentDonors.has(id)).length;
    const monthly: Record<string, number> = {};
    for (const gift of currentGifts) { const month = gift.date.toISOString().slice(0, 7); monthly[month] = (monthly[month] || 0) + moneyToCents(gift.amount); }
    const reconciled = moneyToCents(currentTotal) === moneyToCents(aggregate._sum.amount) && currentGifts.length === aggregate._count;
    return { fiscalYear: year, fiscalYearStartMonth: settings.fiscalYearStart, currency: settings.currency, period: { from: current.gte.toISOString(), through: currentThrough.toISOString() },
      completedGiving: currentTotal, completedGifts: currentGifts.length, distinctDonors: currentDonors.size,
      firstTimeDonors: firstGifts.filter(gift => gift._min.date && gift._min.date >= current.gte && gift._min.date <= currentThrough).length,
      recurringDonors: new Set(currentGifts.filter(gift => gift.isRecurring).map(gift => gift.constituentId)).size,
      retention: { priorDonors: priorDonors.size, retained, percent: priorDonors.size ? calcRetentionRate(retained, priorDonors.size) : null },
      priorFullYearGiving: priorTotal, fullYearGrowthPercent: currentThrough.getTime() === current.lt.getTime() - 1 ? calcYoYPercent(currentTotal, priorTotal) : null,
      sameElapsedPriorYear: { from: (comparison.gte as Date).toISOString(), through: (comparison.lte as Date).toISOString(), giving: total(priorElapsed), changePercent: calcYoYPercent(currentTotal, total(priorElapsed)) },
      monthlyGiving: Object.fromEntries(Object.entries(monthly).sort().map(([month, cents]) => [month, centsToMoney(cents)])), reconciled,
      definitions: "COMPLETED donation records only, including completed gifts assigned to grant-named funds. Separate grant awards and unreceived pledges excluded. UTC gift dates; distinct donor IDs; recurring uses gift flags. No donor identities included." };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.reconciled) process.exitCode = 1;
}
main().catch(() => { console.error("Fiscal audit failed. Check organization/year, database access and the 50,000-gift limit. No records were changed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
