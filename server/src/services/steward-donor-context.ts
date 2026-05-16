/**
 * Controlled donor intelligence layer for Steward read tools.
 * All donor analysis here is organization-scoped, deterministic, and explainable.
 */
import type { DonorStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  calculateLapseRisk,
  calculatePropensityWindow,
  calculateRfmScore,
  type StewardIntelligenceDonorInput,
} from "./steward-intelligence-engine.js";

export interface DonorCommunicationPreferences {
  doNotEmail: boolean;
  emailOptOut: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
  doNotContact: boolean;
}

export interface StewardDecisionSignals {
  generosityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  opportunityScore: number;
  bestNextStep: string;
  bestChannel: "Email" | "Phone" | "Mail" | "None";
}

export interface StewardScoreComponents {
  rfm: {
    recency: number;
    frequency: number;
    monetary: number;
    weighted: number;
  };
  propensity: {
    score: number;
    window: "0-30" | "31-60" | "61-90" | "90+";
    confidence: number;
  };
  lapse: {
    risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    cadenceDays: number;
    daysOverdue: number;
    reason: string;
  };
}

export interface DonorProfileDecisionPacket {
  donor: {
    id: string;
    name: string;
    donorStatus: DonorStatus;
    lastGiftDate: string | null;
    lastGiftAmount: number;
    lifetimeGiving: number;
    giftCount: number;
    communicationPreferences: DonorCommunicationPreferences;
  };
  signals: StewardDecisionSignals;
  scoreComponents: StewardScoreComponents;
  evidence: string[];
}

export interface DailyBriefResult {
  generatedAt: string;
  summary: {
    ytdRevenue: number;
    ytdGiftCount: number;
    thankYousNeeded: number;
    lapseRiskDonorCount: number;
    topOpportunityCount: number;
  };
  topDonors: Array<{
    id: string;
    name: string;
    lifetimeGiving: number;
    lastGiftDate: string | null;
  }>;
  recentGifts: Array<{
    donationId: string;
    constituentId: string;
    donorName: string;
    amount: number;
    date: string;
    campaignName: string | null;
  }>;
}

export interface ThankYouNeededItem {
  donationId: string;
  constituentId: string;
  donorName: string;
  amount: number;
  donationDate: string;
  suggestedChannel: "Email" | "Phone" | "Mail";
  reason: string;
  communicationPreferences: DonorCommunicationPreferences;
}

export interface LapseRiskItem {
  constituentId: string;
  donorName: string;
  donorStatus: DonorStatus;
  lastGiftDate: string | null;
  totalLifetimeGiving: number;
  giftCount: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  daysOverdue: number;
  cadenceDays: number;
  reason: string;
  recommendedChannel: "Email" | "Phone" | "Mail";
}

export interface TopOpportunityItem {
  constituentId: string;
  donorName: string;
  donorStatus: DonorStatus;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  generosityScore: number;
  bestNextStep: string;
  bestChannel: "Email" | "Phone" | "Mail" | "None";
  confidence: number;
  evidence: string[];
}

export interface OShareviewDonorSummaryResult {
  generatedAt: string;
  year: number;
  summary: {
    ytdRevenue: number;
    donorCount: number;
    newDonorsYtd: number;
    ytdGiftCount: number;
    averageGift: number;
    majorGiftCount: number;
    donorRetentionRate: number;
  };
}

function asNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Formats a Date or ISO string into a human-readable "Month DD, YYYY" format for AI context. */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "no date on record";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "unknown date";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function donorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toStewardInput(row: {
  id: string;
  firstName: string;
  lastName: string;
  donorStatus: DonorStatus;
  giftCount: number;
  totalLifetimeGiving: Prisma.Decimal | number;
  lastGiftAmount: Prisma.Decimal | number | null;
  firstGiftDate: Date | null;
  lastGiftDate: Date | null;
  engagementScore: number;
  doNotEmail: boolean;
  doNotCall: boolean;
}): StewardIntelligenceDonorInput {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    donorStatus: row.donorStatus,
    giftCount: row.giftCount,
    totalLifetimeGiving: asNumber(row.totalLifetimeGiving),
    lastGiftAmount: asNumber(row.lastGiftAmount),
    firstGiftDate: row.firstGiftDate,
    lastGiftDate: row.lastGiftDate,
    engagementScore: row.engagementScore,
    doNotEmail: row.doNotEmail,
    doNotCall: row.doNotCall,
  };
}

function toCommunicationPreferences(row: {
  doNotEmail: boolean;
  emailOptOut: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
  doNotContact: boolean;
}): DonorCommunicationPreferences {
  return {
    doNotEmail: row.doNotEmail,
    emailOptOut: row.emailOptOut,
    doNotCall: row.doNotCall,
    doNotMail: row.doNotMail,
    doNotContact: row.doNotContact,
  };
}

function suggestChannel(preferences: DonorCommunicationPreferences): "Email" | "Phone" | "Mail" | "None" {
  if (preferences.doNotContact) return "None";
  if (!preferences.doNotEmail && !preferences.emailOptOut) return "Email";
  if (!preferences.doNotCall) return "Phone";
  if (!preferences.doNotMail) return "Mail";
  return "None";
}

function toOutreachChannel(preferences: DonorCommunicationPreferences): "Email" | "Phone" | "Mail" {
  const channel = suggestChannel(preferences);
  if (channel === "None") return "Mail";
  return channel;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildBestNextStep(options: {
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  giftCount: number;
  donorStatus: DonorStatus;
  preferredChannel: "Email" | "Phone" | "Mail" | "None";
}): string {
  if (options.preferredChannel === "None") {
    return "Do not contact flag is active. Review record with a manager before planning outreach.";
  }

  if (options.lapseRisk === "CRITICAL") {
    return "Create a reconnect task and assign a personalized stewardship touch this week.";
  }

  if (options.giftCount <= 1) {
    return "Send a warm second-gift invitation with a specific mission impact update.";
  }

  if (options.donorStatus === "MAJOR_DONOR") {
    return "Prepare a major-donor stewardship update and schedule a personal follow-up.";
  }

  if (options.lapseRisk === "HIGH" || options.lapseRisk === "MEDIUM") {
    return "Queue a cadence-recovery follow-up and include one clear next-step ask.";
  }

  return "Continue normal stewardship cadence with a gratitude and impact touchpoint.";
}

function computeDecisionSignals(input: StewardIntelligenceDonorInput, preferences: DonorCommunicationPreferences): {
  signals: StewardDecisionSignals;
  components: StewardScoreComponents;
} {
  const rfm = calculateRfmScore(input);
  const lapse = calculateLapseRisk(input);
  const propensity = calculatePropensityWindow(input);

  const generosityScore = clampScore(rfm.score * 0.7 + input.engagementScore * 0.3);
  const opportunityScore = clampScore(propensity.score * 0.75 + rfm.score * 0.25);
  const bestChannel = suggestChannel(preferences);

  const signals: StewardDecisionSignals = {
    generosityScore,
    lapseRisk: lapse.risk,
    opportunityScore,
    bestNextStep: buildBestNextStep({
      lapseRisk: lapse.risk,
      giftCount: input.giftCount,
      donorStatus: input.donorStatus,
      preferredChannel: bestChannel,
    }),
    bestChannel,
  };

  return {
    signals,
    components: {
      rfm: {
        recency: rfm.recency,
        frequency: rfm.frequency,
        monetary: rfm.monetary,
        weighted: rfm.score,
      },
      propensity: {
        score: propensity.score,
        window: propensity.window,
        confidence: propensity.confidence,
      },
      lapse: {
        risk: lapse.risk,
        cadenceDays: lapse.cadenceDays,
        daysOverdue: lapse.daysOverdue,
        reason: lapse.reason,
      },
    },
  };
}

/** Returns the daily donor intelligence snapshot used by the Steward brief tool. */
export async function getDailyBrief(organizationId: string): Promise<DailyBriefResult> {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    ytdGiving,
    ytdGiftCount,
    thankYousNeeded,
    topDonors,
    recentGifts,
    recentConstituentSignals,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: yearStart },
      },
      _sum: { amount: true },
    }),
    prisma.donation.count({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: yearStart },
      },
    }),
    prisma.task.count({
      where: {
        constituent: { organizationId },
        type: "THANK_YOU",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    prisma.constituent.findMany({
      where: {
        organizationId,
        totalLifetimeGiving: { gt: 0 },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        totalLifetimeGiving: true,
        lastGiftDate: true,
      },
      orderBy: [
        { totalLifetimeGiving: "desc" },
        { lastGiftDate: "desc" },
      ],
      take: 5,
    }),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
      },
      select: {
        id: true,
        constituentId: true,
        amount: true,
        date: true,
        campaign: { select: { name: true } },
        constituent: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
      take: 8,
    }),
    prisma.constituent.findMany({
      where: {
        organizationId,
        lastGiftDate: { gte: last30Days },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        donorStatus: true,
        giftCount: true,
        totalLifetimeGiving: true,
        lastGiftAmount: true,
        firstGiftDate: true,
        lastGiftDate: true,
        engagementScore: true,
        doNotEmail: true,
        doNotCall: true,
      },
      take: 200,
    }),
  ]);

  const scored = recentConstituentSignals.map((row) => {
    const input = toStewardInput(row);
    const lapse = calculateLapseRisk(input);
    const propensity = calculatePropensityWindow(input);
    return {
      lapseRisk: lapse.risk,
      opportunityScore: propensity.score,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ytdRevenue: Math.round(asNumber(ytdGiving._sum.amount)),
      ytdGiftCount,
      thankYousNeeded,
      lapseRiskDonorCount: scored.filter((item) => item.lapseRisk === "HIGH" || item.lapseRisk === "CRITICAL").length,
      topOpportunityCount: scored.filter((item) => item.opportunityScore >= 70).length,
    },
    topDonors: topDonors.map((row) => ({
      id: row.id,
      name: donorName(row.firstName, row.lastName),
      lifetimeGiving: Math.round(asNumber(row.totalLifetimeGiving)),
      lastGiftDate: row.lastGiftDate ? row.lastGiftDate.toISOString() : null,
    })),
    recentGifts: recentGifts.map((row) => ({
      donationId: row.id,
      constituentId: row.constituentId,
      donorName: donorName(row.constituent.firstName, row.constituent.lastName),
      amount: asNumber(row.amount),
      date: row.date.toISOString(),
      campaignName: row.campaign?.name ?? null,
    })),
  };
}

/** Returns donors with pending thank-you work derived from recent completed gifts. */
export async function getThankYousNeeded(
  organizationId: string,
  options?: { limit?: number }
): Promise<ThankYouNeededItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 200);
  const last120Days = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

  const donations = await prisma.donation.findMany({
    where: {
      constituent: { organizationId },
      status: "COMPLETED",
      date: { gte: last120Days },
      acknowledgmentSentAt: null,
    },
    select: {
      id: true,
      constituentId: true,
      amount: true,
      date: true,
      constituent: {
        select: {
          firstName: true,
          lastName: true,
          doNotEmail: true,
          emailOptOut: true,
          doNotCall: true,
          doNotMail: true,
          doNotContact: true,
        },
      },
    },
    orderBy: { date: "desc" },
    take: limit * 2,
  });

  const openThankYouCounts = await prisma.task.groupBy({
    by: ["constituentId"],
    where: {
      constituentId: { in: donations.map((row) => row.constituentId) },
      type: "THANK_YOU",
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    _count: { _all: true },
  });

  const openMap = new Map(openThankYouCounts.map((row) => [row.constituentId, row._count._all]));

  return donations
    .filter((row) => (openMap.get(row.constituentId) ?? 0) === 0)
    .slice(0, limit)
    .map((row) => {
      const preferences = toCommunicationPreferences(row.constituent);
      const channel = toOutreachChannel(preferences);
      const reason = preferences.doNotContact
        ? "Do-not-contact is enabled; manager review required before outreach."
        : "Completed gift has no open thank-you task and no acknowledgment timestamp.";

      return {
        donationId: row.id,
        constituentId: row.constituentId,
        donorName: donorName(row.constituent.firstName, row.constituent.lastName),
        amount: asNumber(row.amount),
        donationDate: row.date.toISOString(),
        suggestedChannel: channel,
        reason,
        communicationPreferences: preferences,
      };
    });
}

/** Returns donors most at risk of lapse with explainable cadence evidence. */
export async function getLapseRisks(
  organizationId: string,
  options?: { limit?: number; minimumRisk?: "MEDIUM" | "HIGH" | "CRITICAL" }
): Promise<LapseRiskItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 250);
  const minimumRisk = options?.minimumRisk ?? "MEDIUM";

  const rows = await prisma.constituent.findMany({
    where: {
      organizationId,
      totalLifetimeGiving: { gt: 0 },
      giftCount: { gt: 0 },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      giftCount: true,
      totalLifetimeGiving: true,
      lastGiftAmount: true,
      firstGiftDate: true,
      lastGiftDate: true,
      engagementScore: true,
      doNotEmail: true,
      emailOptOut: true,
      doNotCall: true,
      doNotMail: true,
      doNotContact: true,
    },
    orderBy: [{ lastGiftDate: "asc" }],
    take: 1000,
  });

  const minRank: Record<"MEDIUM" | "HIGH" | "CRITICAL", number> = {
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  const rank: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  return rows
    .map((row) => {
      const input = toStewardInput(row);
      const lapse = calculateLapseRisk(input);
      const preferences = toCommunicationPreferences(row);
      return {
        constituentId: row.id,
        donorName: donorName(row.firstName, row.lastName),
        donorStatus: row.donorStatus,
        lastGiftDate: row.lastGiftDate ? row.lastGiftDate.toISOString() : null,
        totalLifetimeGiving: asNumber(row.totalLifetimeGiving),
        giftCount: row.giftCount,
        lapseRisk: lapse.risk,
        daysOverdue: lapse.daysOverdue,
        cadenceDays: lapse.cadenceDays,
        reason: lapse.reason,
        recommendedChannel: toOutreachChannel(preferences),
      };
    })
    .filter((row) => rank[row.lapseRisk] >= minRank[minimumRisk])
    .sort((left, right) => {
      if (rank[left.lapseRisk] !== rank[right.lapseRisk]) {
        return rank[right.lapseRisk] - rank[left.lapseRisk];
      }
      return right.daysOverdue - left.daysOverdue;
    })
    .slice(0, limit);
}

/** Returns high-confidence donor opportunities with explicit evidence strings. */
export async function getTopOpportunities(
  organizationId: string,
  options?: { limit?: number }
): Promise<TopOpportunityItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 150);

  const rows = await prisma.constituent.findMany({
    where: {
      organizationId,
      totalLifetimeGiving: { gt: 0 },
      giftCount: { gt: 0 },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      giftCount: true,
      totalLifetimeGiving: true,
      lastGiftAmount: true,
      firstGiftDate: true,
      lastGiftDate: true,
      engagementScore: true,
      doNotEmail: true,
      emailOptOut: true,
      doNotCall: true,
      doNotMail: true,
      doNotContact: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 1200,
  });

  return rows
    .map((row) => {
      const input = toStewardInput(row);
      const preferences = toCommunicationPreferences(row);
      const { signals, components } = computeDecisionSignals(input, preferences);
      const evidence = [
        `Gift count is ${row.giftCount}.`,
        `Last gift date is ${row.lastGiftDate ? row.lastGiftDate.toISOString().slice(0, 10) : "unknown"}.`,
        `RFM weighted score is ${components.rfm.weighted}.`,
        `Lapse risk is ${components.lapse.risk} (${components.lapse.daysOverdue} days overdue).`,
      ];

      return {
        constituentId: row.id,
        donorName: donorName(row.firstName, row.lastName),
        donorStatus: row.donorStatus,
        opportunityScore: signals.opportunityScore,
        lapseRisk: signals.lapseRisk,
        generosityScore: signals.generosityScore,
        bestNextStep: signals.bestNextStep,
        bestChannel: signals.bestChannel,
        confidence: components.propensity.confidence,
        evidence,
      };
    })
    .filter((row) => row.bestChannel !== "None")
    .sort((left, right) => {
      if (left.opportunityScore !== right.opportunityScore) {
        return right.opportunityScore - left.opportunityScore;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, limit);
}

/** Returns a donor-level decision packet for Steward explainability and guided actioning. */
export async function getProfileDecisionPacket(
  organizationId: string,
  constituentId: string
): Promise<DonorProfileDecisionPacket | null> {
  const [constituent, recentDonations, openTasks] = await Promise.all([
    prisma.constituent.findFirst({
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
        totalLifetimeGiving: true,
        lastGiftAmount: true,
        firstGiftDate: true,
        lastGiftDate: true,
        engagementScore: true,
        doNotEmail: true,
        emailOptOut: true,
        doNotCall: true,
        doNotMail: true,
        doNotContact: true,
      },
    }),
    prisma.donation.findMany({
      where: {
        constituentId,
        status: "COMPLETED",
      },
      select: {
        amount: true,
        date: true,
        campaign: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.task.count({
      where: {
        constituentId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  if (!constituent) return null;

  const input = toStewardInput(constituent);
  const preferences = toCommunicationPreferences(constituent);
  const { signals, components } = computeDecisionSignals(input, preferences);

  const evidence: string[] = [
    `Gift count is ${constituent.giftCount}.`,
    `Lifetime giving is $${asNumber(constituent.totalLifetimeGiving).toLocaleString()}.`,
    `Lapse risk is ${components.lapse.risk} because ${components.lapse.reason}`,
    `Opportunity confidence is ${components.propensity.confidence}% in the ${components.propensity.window} day window.`,
    `Open stewardship tasks: ${openTasks}.`,
  ];

  if (recentDonations.length > 0) {
    evidence.push(
      ...recentDonations.slice(0, 3).map((gift) =>
        `Recent gift ${gift.date.toISOString().slice(0, 10)} for $${asNumber(gift.amount).toLocaleString()}${gift.campaign?.name ? ` (${gift.campaign.name})` : ""}.`
      )
    );
  } else {
    evidence.push("No recent completed gifts found in donor history.");
  }

  return {
    donor: {
      id: constituent.id,
      name: donorName(constituent.firstName, constituent.lastName),
      donorStatus: constituent.donorStatus,
      lastGiftDate: constituent.lastGiftDate ? constituent.lastGiftDate.toISOString() : null,
      lastGiftAmount: asNumber(constituent.lastGiftAmount),
      lifetimeGiving: asNumber(constituent.totalLifetimeGiving),
      giftCount: constituent.giftCount,
      communicationPreferences: preferences,
    },
    signals,
    scoreComponents: components,
    evidence,
  };
}

/** Returns a compact OShareview-compatible donor summary for board/report contexts. */
export async function getOShareviewDonorSummary(
  organizationId: string,
  options?: { year?: number }
): Promise<OShareviewDonorSummaryResult> {
  const now = new Date();
  const year = options?.year ?? now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  const previousYearStart = new Date(year - 1, 0, 1);

  const [
    ytdDonations,
    donorCount,
    newDonorsYtd,
    lastYearDonorIds,
    thisYearDonorIds,
  ] = await Promise.all([
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: yearStart, lt: nextYearStart },
      },
      select: {
        amount: true,
      },
    }),
    prisma.constituent.count({ where: { organizationId } }),
    prisma.constituent.count({
      where: {
        organizationId,
        firstGiftDate: { gte: yearStart, lt: nextYearStart },
      },
    }),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: previousYearStart, lt: yearStart },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: yearStart, lt: nextYearStart },
      },
      select: { constituentId: true },
      distinct: ["constituentId"],
    }),
  ]);

  const ytdRevenue = ytdDonations.reduce((sum, row) => sum + asNumber(row.amount), 0);
  const ytdGiftCount = ytdDonations.length;
  const averageGift = ytdGiftCount > 0 ? ytdRevenue / ytdGiftCount : 0;
  const majorGiftCount = ytdDonations.filter((row) => asNumber(row.amount) >= 1000).length;

  const lastYearSet = new Set(lastYearDonorIds.map((row) => row.constituentId));
  const thisYearSet = new Set(thisYearDonorIds.map((row) => row.constituentId));
  const retainedDonors = Array.from(lastYearSet).filter((id) => thisYearSet.has(id)).length;
  const donorRetentionRate = lastYearSet.size > 0 ? Math.round((retainedDonors / lastYearSet.size) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    year,
    summary: {
      ytdRevenue: Math.round(ytdRevenue),
      donorCount,
      newDonorsYtd,
      ytdGiftCount,
      averageGift: Math.round(averageGift),
      majorGiftCount,
      donorRetentionRate,
    },
  };
}

// ─── New RAG service functions ─────────────────────────────────────────────

export interface DonorFullProfileResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  donorStatus: DonorStatus;
  totalLifetimeGiving: number;
  giftCount: number;
  firstGiftDate: string | null;
  lastGiftDate: string | null;
  lastGiftAmount: number;
  tags: string[];
  tagContexts: Array<{ name: string; description: string | null }>;
  recentDonations: Array<{
    id: string;
    amount: number;
    date: string;
    campaign: string | null;
    notes: string | null;
    paymentMethod: string | null;
    acknowledged: boolean;
  }>;
  openTasks: Array<{
    title: string;
    dueDate: string | null;
    priority: string;
    status: string;
  }>;
  signals: StewardDecisionSignals;
  communicationPreferences: DonorCommunicationPreferences;
}

/** Returns a comprehensive profile for a single donor including giving history, tasks, and stewardship signals. */
export async function getDonorFullProfile(
  organizationId: string,
  constituentId: string
): Promise<DonorFullProfileResult | null> {
  const [constituent, recentDonations, openTasks] = await Promise.all([
    prisma.constituent.findFirst({
      where: { id: constituentId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        donorStatus: true,
        giftCount: true,
        totalLifetimeGiving: true,
        lastGiftAmount: true,
        firstGiftDate: true,
        lastGiftDate: true,
        engagementScore: true,
        doNotEmail: true,
        emailOptOut: true,
        doNotCall: true,
        doNotMail: true,
        doNotContact: true,
        tags: { select: { tag: { select: { name: true, description: true } } } },
      },
    }),
    prisma.donation.findMany({
      where: { constituentId, status: "COMPLETED" },
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true,
        amount: true,
        date: true,
        notes: true,
        paymentMethod: true,
        acknowledgmentSentAt: true,
        campaign: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { constituentId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: [{ dueDate: "asc" }],
      take: 6,
      select: { title: true, dueDate: true, priority: true, status: true, assigneeId: true },
    }),
  ]);

  if (!constituent) return null;

  const input = toStewardInput(constituent);
  const preferences = toCommunicationPreferences(constituent);
  const { signals } = computeDecisionSignals(input, preferences);

  return {
    id: constituent.id,
    name: donorName(constituent.firstName, constituent.lastName),
    email: constituent.email,
    phone: constituent.phone ?? null,
    donorStatus: constituent.donorStatus,
    totalLifetimeGiving: asNumber(constituent.totalLifetimeGiving),
    giftCount: constituent.giftCount,
    firstGiftDate: constituent.firstGiftDate ? fmtDate(constituent.firstGiftDate) : null,
    lastGiftDate: constituent.lastGiftDate ? fmtDate(constituent.lastGiftDate) : null,
    lastGiftAmount: asNumber(constituent.lastGiftAmount),
    tags: constituent.tags.map((ct) => ct.tag.name),
    tagContexts: constituent.tags.map((ct) => ({ name: ct.tag.name, description: ct.tag.description })),
    recentDonations: recentDonations.map((d) => ({
      id: d.id,
      amount: asNumber(d.amount),
      date: fmtDate(d.date),
      campaign: d.campaign?.name ?? null,
      notes: d.notes?.slice(0, 200) ?? null,
      paymentMethod: d.paymentMethod ?? null,
      acknowledged: Boolean(d.acknowledgmentSentAt),
    })),
    openTasks: openTasks.map((t) => ({
      title: t.title,
      dueDate: t.dueDate ? fmtDate(t.dueDate) : null,
      priority: t.priority,
      status: t.status,
    })) as DonorFullProfileResult["openTasks"],
    signals,
    communicationPreferences: preferences,
  };
}

export interface DonationHistoryItem {
  id: string;
  amount: number;
  date: string;
  campaign: string | null;
  paymentMethod: string | null;
  notes: string | null;
  acknowledged: boolean;
}

/** Returns paginated donation history for a single constituent. */
export async function getDonationHistory(
  organizationId: string,
  constituentId: string,
  options?: { limit?: number }
): Promise<{ donorName: string; donations: DonationHistoryItem[]; totalCount: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);

  const [constituent, donations, totalCount] = await Promise.all([
    prisma.constituent.findFirst({
      where: { id: constituentId, organizationId },
      select: { firstName: true, lastName: true },
    }),
    prisma.donation.findMany({
      where: { constituentId, constituent: { organizationId }, status: "COMPLETED" },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        date: true,
        paymentMethod: true,
        notes: true,
        acknowledgmentSentAt: true,
        campaign: { select: { name: true } },
      },
    }),
    prisma.donation.count({
      where: { constituentId, constituent: { organizationId }, status: "COMPLETED" },
    }),
  ]);

  if (!constituent) return { donorName: "Unknown", donations: [], totalCount: 0 };

  return {
    donorName: donorName(constituent.firstName, constituent.lastName),
    donations: donations.map((d) => ({
      id: d.id,
      amount: asNumber(d.amount),
      date: fmtDate(d.date),
      campaign: d.campaign?.name ?? null,
      paymentMethod: d.paymentMethod ?? null,
      notes: d.notes?.slice(0, 200) ?? null,
      acknowledged: Boolean(d.acknowledgmentSentAt),
    })),
    totalCount,
  };
}

export interface GiftSummaryByYearResult {
  donorName: string;
  years: Array<{
    year: number;
    totalAmount: number;
    giftCount: number;
    largestGift: number;
  }>;
}

/** Returns year-over-year giving totals for a single donor (last 6 calendar years). */
export async function getGiftSummaryByYear(
  organizationId: string,
  constituentId: string
): Promise<GiftSummaryByYearResult> {
  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { firstName: true, lastName: true },
  });

  if (!constituent) return { donorName: "Unknown", years: [] };

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;

  const donations = await prisma.donation.findMany({
    where: {
      constituentId,
      constituent: { organizationId },
      status: "COMPLETED",
      date: { gte: new Date(startYear, 0, 1) },
    },
    select: { amount: true, date: true },
    orderBy: { date: "desc" },
  });

  const byYear = new Map<number, { total: number; count: number; largest: number }>();
  for (const d of donations) {
    const yr = d.date.getFullYear();
    const existing = byYear.get(yr) ?? { total: 0, count: 0, largest: 0 };
    const amt = asNumber(d.amount);
    byYear.set(yr, {
      total: existing.total + amt,
      count: existing.count + 1,
      largest: Math.max(existing.largest, amt),
    });
  }

  const years = [];
  for (let yr = currentYear; yr >= startYear; yr--) {
    const data = byYear.get(yr);
    if (data) {
      years.push({
        year: yr,
        totalAmount: Math.round(data.total),
        giftCount: data.count,
        largestGift: Math.round(data.largest),
      });
    }
  }

  return {
    donorName: donorName(constituent.firstName, constituent.lastName),
    years,
  };
}

export interface ActiveCampaignSummary {
  id: string;
  name: string;
  goal: number;
  raised: number;
  progressPercent: number;
  startDate: string | null;
  endDate: string | null;
  giftCount: number;
}

/** Returns all active campaigns with real-time giving progress. */
export async function getActiveCampaigns(organizationId: string): Promise<ActiveCampaignSummary[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId, active: true },
    orderBy: { startDate: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      goal: true,
      startDate: true,
      endDate: true,
      _count: { select: { donations: true } },
    },
  });

  const campaignIds = campaigns.map((c) => c.id);
  const giving = await prisma.donation.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: campaignIds },
      status: "COMPLETED",
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const givingMap = new Map(
    giving.map((row) => [row.campaignId, { raised: asNumber(row._sum.amount), count: row._count._all }])
  );

  return campaigns.map((c) => {
    const goal = asNumber(c.goal);
    const progress = givingMap.get(c.id) ?? { raised: 0, count: 0 };
    return {
      id: c.id,
      name: c.name,
      goal: Math.round(goal),
      raised: Math.round(progress.raised),
      progressPercent: goal > 0 ? Math.round((progress.raised / goal) * 100) : 0,
      startDate: c.startDate ? fmtDate(c.startDate) : null,
      endDate: c.endDate ? fmtDate(c.endDate) : null,
      giftCount: progress.count,
    };
  });
}

export interface OverdueTaskItem {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  donorName: string | null;
  constituentId: string | null;
  assigneeName: string | null;
  daysOverdue: number;
}

/** Returns tasks past their due date, ordered by oldest first. */
export async function getOverdueTasks(
  organizationId: string,
  options?: { limit?: number }
): Promise<OverdueTaskItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      constituent: { organizationId },
      status: { in: ["PENDING", "IN_PROGRESS"] },
      dueDate: { lt: now },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      constituentId: true,
      constituent: { select: { firstName: true, lastName: true } },
      assignee: { select: { firstName: true, lastName: true } },
    },
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate ? fmtDate(t.dueDate) : "no due date",
    priority: t.priority,
    constituentId: t.constituentId ?? null,
    donorName: t.constituent
      ? donorName(t.constituent.firstName, t.constituent.lastName)
      : null,
    assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() : null,
    daysOverdue: t.dueDate
      ? Math.floor((now.getTime() - t.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));
}
