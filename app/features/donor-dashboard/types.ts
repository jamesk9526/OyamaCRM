/**
 * Shared Donor Dashboard contracts for real-data workspace rendering.
 */

export type HeroImagePosition = "center" | "top" | "bottom" | "left" | "right";
export type HeroHeight = "compact" | "standard" | "large";
export type DashboardDensity = "comfortable" | "compact";
export type DashboardDefaultPeriod = "this-month" | "fiscal-ytd" | "calendar-ytd";
export type GreetingStyle = "formal" | "warm" | "simple";
export type DashboardHeroActionId = "record-gift" | "view-reports" | "open-tasks";

export interface DashboardAppearanceSettings {
  headerImageUrl: string;
  headerImagePosition: HeroImagePosition;
  overlayStrength: number;
  overlayColor: string;
  showQuoteCard: boolean;
  quoteText: string;
  quoteAuthor: string;
  heroTitleMode: "greeting" | "mission" | "custom";
  customHeroText: string;
  greetingStyle: GreetingStyle;
  primaryActions: DashboardHeroActionId[];
  heroHeight: HeroHeight;
  density: DashboardDensity;
  defaultPeriod: DashboardDefaultPeriod;
  defaultCampaignId: string;
  showMetricCards: boolean;
  showStewardSuggestions: boolean;
  showRecentDonorMovement: boolean;
  showThisMonthsDonors: boolean;
  showFollowUpWidgets: boolean;
  showExpandedWidgets: boolean;
  showCampaignImpactCards: boolean;
  showProjectsAndInitiatives: boolean;
}

export interface DonationPreview {
  id: string;
  amount: number | string;
  date: string;
  paymentMethod?: string | null;
  constituent?: { id: string; firstName: string; lastName: string } | null;
  campaign?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  acknowledgmentSentAt?: string | null;
}

export interface TrendPoint {
  label: string;
  amount: number;
}

export interface DesignationSlice {
  name: string;
  amount: number;
}

export interface CampaignImpact {
  id: string;
  name: string;
  goal: number | string | null;
  totalRaised?: number | string | null;
  endDate?: string | null;
  category?: string | null;
  active: boolean;
}

export interface StewardSuggestion {
  id: string;
  type: "lapsed" | "threshold" | "welcome" | "pending_task" | "retention";
  title: string;
  description: string;
  action: { label: string; href: string };
  count?: number;
  urgency: "high" | "medium" | "low";
}

export interface DonorDashboardSummary {
  totalConstituents: number;
  activeDonors?: number;
  ytdAmount?: number;
  ytdCount?: number;
  monthAmount: number;
  momTrend: number | null;
  pendingTasks: number;
  overdueTasks: number;
  activeCampaigns: number;
  newDonorsThisMonth: number;
}

export interface RetentionData {
  retained: number;
  total: number;
  rate: number;
}

export interface DashboardData {
  period: DashboardDefaultPeriod;
  appearance: DashboardAppearanceSettings;
  recentDonations: DonationPreview[];
  trendPoints: TrendPoint[];
  trendTotal: number;
  trendGiftCount: number;
  trendPercent: number | null;
  designationSlices: DesignationSlice[];
  designationTotal: number;
  campaigns: CampaignImpact[];
  stewardshipAlerts: StewardSuggestion[];
  errors: string[];
}
