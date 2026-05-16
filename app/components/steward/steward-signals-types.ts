/** Shared client-side contracts for Steward Signals dashboard workspace APIs. */

export interface StewardSummaryResponse {
  donorHealthScore: number;
  highOpportunityDonors: number;
  atRiskCadenceBroken: number;
  criticalLapseRisk: number;
  thankYousNeeded: number;
  monthlyGivingCandidates: number;
  firstTimeDonorFollowUpNeeded: number;
  majorDonorMovement: number;
  openStewardshipActions: number;
  lapsedDonors: number;
  updatedAt: string;
}

export interface StewardFocusLine {
  id: string;
  title: string;
  count: number;
  detail: string;
}

export interface StewardPriorityCard {
  id: string;
  constituentId: string;
  donorName: string;
  opportunityType: string;
  why: string;
  suggestedAction: string;
  suggestedChannel: string;
  dueDateIso: string;
  confidence: number;
  urgency: "Critical" | "High" | "Medium" | "Low";
  evidence: string;
}

export interface StewardDashboardFocusResponse {
  scope: "Donor CRM";
  analyzedAt: string;
  focusLines: StewardFocusLine[];
  topPriorities: StewardPriorityCard[];
}

export interface StewardOpportunityRow {
  id: string;
  constituentId: string;
  donorName: string;
  priority: "High" | "Medium" | "Low";
  opportunityType: string;
  reason: string;
  suggestedAction: string;
  channel: string;
  dueDateIso: string;
  ownerName: string;
  status: "Queued" | "Needs Review";
  confidence: number;
  confidenceReason: string;
}

export interface StewardTaskSuggestionRow {
  id: string;
  opportunityId: string;
  constituentId: string;
  donorName: string;
  title: string;
  description: string;
  taskType: "THANK_YOU" | "FOLLOW_UP";
  priority: "HIGH" | "MEDIUM" | "LOW";
  channel: string;
  dueDateIso: string;
  confidence: number;
  confidenceReason: string;
  reason: string;
}

export interface StewardResearchDonorRow {
  constituentId: string;
  donorName: string;
  donorStatus: "NEW" | "ACTIVE" | "LAPSED" | "MAJOR_DONOR" | "DECEASED";
  giftCount: number;
  lastGiftDate: string | null;
  recencyDays: number;
  totalLifetimeGiving: number;
  averageGift: number;
  largestGift: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  opportunityScore: number;
  monthlyGivingLikelihood: number;
  upgradeLikelihood: number;
  communicationEngagementScore: number;
  campaignResponses: number;
  eventResponses: number;
  thankYouPending: number;
  majorDonorMovement: string;
  why: string;
}

export interface StewardResearchResponse {
  mode: "research" | "cohort";
  scenario: string;
  query: string;
  analyzedAt: string;
  summary: string;
  confidence: number;
  reasoning: string;
  donorCount: number;
  filtersUsed: string[];
  chart: {
    lapseDistribution: Array<{ label: string; value: number }>;
    opportunityBands: Array<{ label: string; value: number }>;
  };
  suggestedActions: string[];
  donors: StewardResearchDonorRow[];
  inDevelopmentNote?: string;
}

export interface StewardLapseRadarResponse {
  cohorts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  sample: Array<{
    constituentId: string;
    donorName: string;
    lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    recommendedAction: string;
  }>;
  distribution: Array<{ label: string; value: number; percentage: number }>;
  groups: {
    newlyMovedIntoRisk: number;
    recoverableLapsedDonors: number;
    highValueLapsedDonors: number;
    needsPersonalContact: number;
    safeForGeneralCampaign: number;
  };
  updatedAt: string;
}
