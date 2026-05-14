/**
 * Deterministic Steward Intelligence engine.
 *
 * This module keeps donor-analysis logic explainable and auditable:
 * math + rules + donor history first, AI explanation second.
 */
import type { DonorStatus } from "@prisma/client";

export type StewardLapseRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface StewardIntelligenceDonorInput {
  id: string;
  firstName: string;
  lastName: string;
  donorStatus: DonorStatus;
  giftCount: number;
  totalLifetimeGiving: number;
  lastGiftAmount: number;
  firstGiftDate: Date | null;
  lastGiftDate: Date | null;
  engagementScore: number;
  doNotEmail: boolean;
  doNotCall: boolean;
}

export interface RfmScoreResult {
  recency: number;
  frequency: number;
  monetary: number;
  score: number;
}

export interface LapseRiskResult {
  risk: StewardLapseRisk;
  expectedNextGiftDate: Date | null;
  daysOverdue: number;
  cadenceDays: number;
  reason: string;
}

export interface PropensityWindowResult {
  score: number;
  window: "0-30" | "31-60" | "61-90" | "90+";
  confidence: number;
  reason: string;
}

export interface GrowthIdeaResult {
  id: string;
  title: string;
  whyItMatters: string;
  estimatedDonorCount: number;
  suggestedMessage: string;
  suggestedChannel: "Email" | "Phone" | "Mail" | "Mixed";
  suggestedActionPlan: string;
  suggestedStewardPath: string;
  confidence: number;
}

export interface DailyStewardThought {
  title: string;
  message: string;
  reason: string;
  sourceType: "ai" | "rules";
}

export interface DailyThoughtContext {
  firstTimeDonorsThisMonth: number;
  thankYousNeeded: number;
  atRiskCount: number;
  monthlyGivingCandidates: number;
  highOpportunityCount: number;
}

export interface EmailDraftStudioInput {
  donorName: string;
  donorFirstName: string;
  messageGoal:
    | "THANK_YOU"
    | "FIRST_TIME_WELCOME"
    | "SECOND_GIFT_INVITATION"
    | "MONTHLY_GIVING_INVITATION"
    | "LAPSED_RECONNECT"
    | "EVENT_FOLLOW_UP"
    | "CAMPAIGN_UPDATE"
    | "MAJOR_DONOR_CHECK_IN"
    | "GENERAL_STEWARDSHIP"
    | "CUSTOM";
  messageIdea: string;
  tone: "WARM" | "BRIEF" | "FORMAL" | "PERSONAL" | "ENCOURAGING" | "PASTORAL" | "PROFESSIONAL";
  length: "SHORT" | "MEDIUM" | "DETAILED";
  includeGivingContext: boolean;
  includeCampaignContext: boolean;
  includeMinistryImpact: boolean;
  callToAction: string;
  signature: string;
}

export interface EmailDraftStudioArtifact {
  type: "email_draft";
  title: string;
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  bodyPlainText: string;
  bodyHtml: string;
  warnings: string[];
  audience: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function daysSince(date: Date | null): number {
  if (!date) return 9999;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function scoreRecency(lastGiftDate: Date | null): number {
  const days = daysSince(lastGiftDate);
  if (days <= 14) return 100;
  if (days <= 30) return 90;
  if (days <= 60) return 78;
  if (days <= 90) return 64;
  if (days <= 180) return 48;
  if (days <= 365) return 28;
  if (days <= 730) return 12;
  return 5;
}

function scoreFrequency(giftCount: number): number {
  if (giftCount <= 0) return 0;
  if (giftCount === 1) return 24;
  if (giftCount === 2) return 44;
  if (giftCount === 3) return 58;
  if (giftCount <= 5) return 72;
  if (giftCount <= 8) return 84;
  return 96;
}

function scoreMonetary(totalLifetimeGiving: number, lastGiftAmount: number): number {
  const lifetime = Math.max(0, totalLifetimeGiving);
  const latest = Math.max(0, lastGiftAmount);

  const lifetimeScore = clamp(Math.round(Math.log10(lifetime + 10) * 28), 0, 78);
  const latestScore = clamp(Math.round(Math.log10(latest + 10) * 10), 0, 22);
  return clamp(lifetimeScore + latestScore, 0, 100);
}

export function calculateRfmScore(input: StewardIntelligenceDonorInput): RfmScoreResult {
  const recency = scoreRecency(input.lastGiftDate);
  const frequency = scoreFrequency(input.giftCount);
  const monetary = scoreMonetary(input.totalLifetimeGiving, input.lastGiftAmount);

  const weighted = Math.round(recency * 0.4 + frequency * 0.3 + monetary * 0.3);

  return {
    recency,
    frequency,
    monetary,
    score: clamp(weighted, 0, 100),
  };
}

function deriveCadenceDays(input: StewardIntelligenceDonorInput): number {
  const firstGiftDate = input.firstGiftDate;
  const lastGiftDate = input.lastGiftDate;

  if (!firstGiftDate || !lastGiftDate || input.giftCount < 2) {
    return 365;
  }

  const spanDays = Math.max(1, Math.floor((lastGiftDate.getTime() - firstGiftDate.getTime()) / (1000 * 60 * 60 * 24)));
  const intervals = Math.max(1, input.giftCount - 1);
  return clamp(Math.round(spanDays / intervals), 30, 540);
}

export function calculateLapseRisk(input: StewardIntelligenceDonorInput): LapseRiskResult {
  const cadenceDays = deriveCadenceDays(input);
  const elapsed = daysSince(input.lastGiftDate);
  const expectedNextGiftDate = input.lastGiftDate
    ? new Date(input.lastGiftDate.getTime() + cadenceDays * 24 * 60 * 60 * 1000)
    : null;
  const daysOverdue = input.lastGiftDate ? Math.max(0, elapsed - cadenceDays) : 0;

  if (input.donorStatus === "LAPSED") {
    return {
      risk: "CRITICAL",
      expectedNextGiftDate,
      daysOverdue,
      cadenceDays,
      reason: "Constituent is currently labeled lapsed.",
    };
  }

  if (elapsed > cadenceDays * 3 || elapsed > 730) {
    return {
      risk: "CRITICAL",
      expectedNextGiftDate,
      daysOverdue,
      cadenceDays,
      reason: `Giving cadence is deeply overdue (${daysOverdue} days).`,
    };
  }

  if (elapsed > cadenceDays * 2 || elapsed > 365) {
    return {
      risk: "HIGH",
      expectedNextGiftDate,
      daysOverdue,
      cadenceDays,
      reason: `Cadence appears broken with ${daysOverdue} days overdue.`,
    };
  }

  if (elapsed > cadenceDays * 1.3 || elapsed > 180) {
    return {
      risk: "MEDIUM",
      expectedNextGiftDate,
      daysOverdue,
      cadenceDays,
      reason: "Giving rhythm is drifting and should be monitored.",
    };
  }

  return {
    risk: "LOW",
    expectedNextGiftDate,
    daysOverdue,
    cadenceDays,
    reason: "Donor appears to be inside expected giving cadence.",
  };
}

export function calculatePropensityWindow(input: StewardIntelligenceDonorInput): PropensityWindowResult {
  const rfm = calculateRfmScore(input);
  const lapse = calculateLapseRisk(input);

  let score = Math.round(rfm.score * 0.65 + input.engagementScore * 0.35);
  if (lapse.risk === "LOW") score += 6;
  if (lapse.risk === "MEDIUM") score -= 8;
  if (lapse.risk === "HIGH") score -= 15;
  if (lapse.risk === "CRITICAL") score -= 25;

  score = clamp(score, 1, 99);

  let window: PropensityWindowResult["window"] = "90+";
  if (score >= 75) window = "0-30";
  else if (score >= 58) window = "31-60";
  else if (score >= 42) window = "61-90";

  const confidence = clamp(Math.round(score * 0.72 + (100 - lapse.daysOverdue) * 0.12 + rfm.recency * 0.16), 45, 96);

  return {
    score,
    window,
    confidence,
    reason: `Propensity from RFM ${rfm.score}, engagement ${input.engagementScore}, and lapse risk ${lapse.risk}.`,
  };
}

export function buildGrowthIdeas(inputs: StewardIntelligenceDonorInput[]): GrowthIdeaResult[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const firstTimeRecent = inputs.filter((donor) => donor.giftCount === 1 && daysSince(donor.lastGiftDate) <= 45);
  const monthlyCandidates = inputs.filter((donor) => donor.giftCount >= 3 && donor.totalLifetimeGiving > 50 && donor.totalLifetimeGiving < 2500);
  const atRisk = inputs.filter((donor) => {
    const lapse = calculateLapseRisk(donor);
    return lapse.risk === "HIGH" || lapse.risk === "CRITICAL";
  });
  const anniversaryMonth = inputs.filter((donor) => donor.lastGiftDate && donor.lastGiftDate.getMonth() === currentMonth && donor.lastGiftDate.getFullYear() < currentYear);
  const highPotential = inputs.filter((donor) => {
    const propensity = calculatePropensityWindow(donor);
    return propensity.score >= 70;
  });

  const ideas: GrowthIdeaResult[] = [
    {
      id: "first-gift-second-gift",
      title: "Invite first-time donors to make a second gift",
      whyItMatters: "Second gifts are a strong retention bridge and often determine whether a donor relationship continues.",
      estimatedDonorCount: firstTimeRecent.length,
      suggestedMessage: "Thank you for your first gift. Your support already made a difference, and we would be honored to partner again.",
      suggestedChannel: "Email",
      suggestedActionPlan: "Prioritize thank-you plus second-gift invitation within 30-45 days of first gift.",
      suggestedStewardPath: "First Gift Welcome -> Second Gift Invitation",
      confidence: firstTimeRecent.length > 0 ? 86 : 52,
    },
    {
      id: "monthly-giving-candidates",
      title: "Ask repeat donors to consider monthly giving",
      whyItMatters: "Monthly commitments improve planning stability and long-term retention.",
      estimatedDonorCount: monthlyCandidates.length,
      suggestedMessage: "Your consistent generosity already helps families each month. Would you consider joining our monthly partner circle?",
      suggestedChannel: "Email",
      suggestedActionPlan: "Start with repeat small donors and add a soft monthly invitation in stewardship follow-up.",
      suggestedStewardPath: "Consistent Donor -> Monthly Invitation",
      confidence: monthlyCandidates.length > 0 ? 82 : 50,
    },
    {
      id: "lapse-reconnect",
      title: "Reconnect donors who are drifting from normal cadence",
      whyItMatters: "Early reconnect outreach can recover relationships before full lapse.",
      estimatedDonorCount: atRisk.length,
      suggestedMessage: "We are grateful for your past support and wanted to share a brief update on recent impact.",
      suggestedChannel: "Mixed",
      suggestedActionPlan: "Queue personal follow-up for high/critical donors and log outcomes for the next review.",
      suggestedStewardPath: "At-Risk Recovery",
      confidence: atRisk.length > 0 ? 88 : 55,
    },
    {
      id: "gift-anniversary",
      title: "Send gift-anniversary gratitude updates",
      whyItMatters: "Anniversary-touch stewardship keeps donor memory fresh and reinforces trust.",
      estimatedDonorCount: anniversaryMonth.length,
      suggestedMessage: "Around this time last year, your giving helped move this mission forward. Thank you for standing with us.",
      suggestedChannel: "Email",
      suggestedActionPlan: "Create a compact anniversary list each month and assign gratitude outreach.",
      suggestedStewardPath: "Anniversary Stewardship",
      confidence: anniversaryMonth.length > 0 ? 78 : 48,
    },
    {
      id: "high-propensity-focus",
      title: "Focus follow-up on high-propensity donors this month",
      whyItMatters: "Concentrating effort where propensity is strongest increases likely positive response.",
      estimatedDonorCount: highPotential.length,
      suggestedMessage: "We would love to share the next chapter of impact and invite you to partner again.",
      suggestedChannel: "Mixed",
      suggestedActionPlan: "Assign staff follow-up queue to top propensity donors and track outcome by channel.",
      suggestedStewardPath: "High Propensity Prioritization",
      confidence: highPotential.length > 0 ? 81 : 49,
    },
  ];

  return ideas
    .filter((idea) => idea.estimatedDonorCount > 0)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 8);
}

export function buildDailyStewardThoughtFallback(context: DailyThoughtContext): DailyStewardThought {
  if (context.firstTimeDonorsThisMonth > 0) {
    return {
      title: "Today\'s Steward Thought",
      message: `${context.firstTimeDonorsThisMonth} donors gave for the first time this month. A warm thank-you today can turn first generosity into lasting partnership.`,
      reason: "Based on first-time donor count in the current month.",
      sourceType: "rules",
    };
  }

  if (context.thankYousNeeded > 0) {
    return {
      title: "Today\'s Steward Thought",
      message: `There are ${context.thankYousNeeded} open thank-you tasks. Closing gratitude loops quickly is one of the strongest retention habits.`,
      reason: "Based on pending thank-you tasks.",
      sourceType: "rules",
    };
  }

  if (context.atRiskCount > 0) {
    return {
      title: "Today\'s Growth Idea",
      message: `${context.atRiskCount} donors are showing cadence drift. A gentle reconnect note this week could prevent deeper lapse.`,
      reason: "Based on at-risk cohort size from lapse signals.",
      sourceType: "rules",
    };
  }

  if (context.monthlyGivingCandidates > 0) {
    return {
      title: "Today\'s Steward Thought",
      message: `${context.monthlyGivingCandidates} donors are strong monthly-giving candidates. Consistent supporters often respond well to simple monthly invitations.`,
      reason: "Based on recurring-candidate count.",
      sourceType: "rules",
    };
  }

  return {
    title: "Today\'s Encouragement",
    message: "Retention is built through small faithful touches. Review recent donors and ensure each one feels seen.",
    reason: "General stewardship fallback message.",
    sourceType: "rules",
  };
}

export function normalizeDailyThoughtAiResponse(raw: string, fallback: DailyStewardThought): DailyStewardThought {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fallback;

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { title?: unknown; message?: unknown; reason?: unknown };
      const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 80) : fallback.title;
      const message = typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim().slice(0, 420) : fallback.message;
      const reason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim().slice(0, 220) : fallback.reason;
      return {
        title,
        message,
        reason,
        sourceType: "ai",
      };
    } catch {
      // Continue to plain-text parsing.
    }
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return fallback;

  const first = lines[0].replace(/^today\'s\s+/i, "Today's ").slice(0, 80);
  const message = lines.slice(1).join(" ").trim().slice(0, 420) || lines[0].slice(0, 420);

  return {
    title: first.includes("Steward") ? first : fallback.title,
    message,
    reason: fallback.reason,
    sourceType: "ai",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToHtml(markdown: string): string {
  const paragraphs = markdown
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`);

  return paragraphs.join("\n") || "<p></p>";
}

function goalLabel(goal: EmailDraftStudioInput["messageGoal"]): string {
  switch (goal) {
    case "THANK_YOU":
      return "Thank You";
    case "FIRST_TIME_WELCOME":
      return "First-Time Welcome";
    case "SECOND_GIFT_INVITATION":
      return "Second Gift Invitation";
    case "MONTHLY_GIVING_INVITATION":
      return "Monthly Giving Invitation";
    case "LAPSED_RECONNECT":
      return "Lapsed Donor Reconnect";
    case "EVENT_FOLLOW_UP":
      return "Event Follow-Up";
    case "CAMPAIGN_UPDATE":
      return "Campaign Update";
    case "MAJOR_DONOR_CHECK_IN":
      return "Major Donor Check-In";
    case "GENERAL_STEWARDSHIP":
      return "General Stewardship";
    default:
      return "Custom Stewardship";
  }
}

function toneLabel(tone: EmailDraftStudioInput["tone"]): string {
  return tone.toLowerCase().replace(/_/g, " ");
}

export function buildDeterministicEmailDraft(input: EmailDraftStudioInput): EmailDraftStudioArtifact {
  const goal = goalLabel(input.messageGoal);
  const subject = `${goal}: Thank you, ${input.donorFirstName}`.slice(0, 180);

  const lines: string[] = [];
  lines.push(`Dear ${input.donorFirstName},`);
  lines.push("");

  if (input.messageGoal === "THANK_YOU" || input.messageGoal === "FIRST_TIME_WELCOME") {
    lines.push("Thank you for your generous support. Your partnership strengthens this mission in real and practical ways.");
  } else if (input.messageGoal === "LAPSED_RECONNECT") {
    lines.push("I wanted to reach out with gratitude for your past support and share that your generosity is still deeply valued.");
  } else {
    lines.push("Thank you for standing with this work. We are grateful for your continued partnership and encouragement.");
  }

  if (input.includeGivingContext) {
    lines.push("");
    lines.push("Your history of giving reflects a meaningful commitment, and we do not take that trust lightly.");
  }

  if (input.includeCampaignContext) {
    lines.push("");
    lines.push("Recent campaign momentum has been encouraging, and supporters like you are a key part of that progress.");
  }

  if (input.includeMinistryImpact) {
    lines.push("");
    lines.push("Because of faithful partners, families continue receiving practical care, resources, and hope.");
  }

  if (input.messageIdea.trim()) {
    lines.push("");
    lines.push(input.messageIdea.trim().slice(0, 500));
  }

  if (input.callToAction.trim()) {
    lines.push("");
    lines.push(input.callToAction.trim().slice(0, 260));
  }

  lines.push("");
  lines.push(input.signature.trim() || "With gratitude,");

  const bodyMarkdown = lines.join("\n").slice(0, 8000);
  const previewText = `${goal} draft in ${toneLabel(input.tone)} tone.`.slice(0, 180);

  const warnings = [
    "Review donor name and context before sending.",
    "Check communication preferences (doNotEmail / opt-out) before delivery.",
    "Draft-first workflow: send only after human review.",
  ];

  return {
    type: "email_draft",
    title: `${goal} Draft`,
    subject,
    previewText,
    bodyMarkdown,
    bodyPlainText: bodyMarkdown,
    bodyHtml: markdownToHtml(bodyMarkdown),
    warnings,
    audience: input.donorName,
  };
}
