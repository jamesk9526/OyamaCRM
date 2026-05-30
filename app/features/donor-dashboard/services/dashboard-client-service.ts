/**
 * Client-side Donor Dashboard data adapter.
 * Centralizes dashboard API calls so cards consume one real-data object.
 */

import { apiFetch } from "@/app/lib/auth-client";
import { normalizeDashboardAppearanceSettings } from "../dashboard-config";
import { buildStewardshipSuggestions, toDashboardNumber } from "../calculations/dashboard-calculations";
import type {
  CampaignImpact,
  DashboardAppearanceSettings,
  DashboardData,
  DesignationSlice,
  DonationPreview,
  DonorDashboardSummary,
  RetentionData,
  TrendPoint,
} from "../types";

interface DonationListResponse {
  items?: DonationPreview[];
  donations?: DonationPreview[];
}

interface TrendResponse {
  points?: TrendPoint[];
  total?: number | string;
  giftCount?: number;
  trendPercent?: number | null;
}

function normalizeTrendPoints(points: TrendPoint[] | undefined): TrendPoint[] {
  return (points ?? []).map((point) => ({
    ...point,
    amount: toDashboardNumber(point.amount),
    count: Number.isFinite(Number(point.count)) ? Number(point.count) : undefined,
    giftCount: Number.isFinite(Number(point.giftCount)) ? Number(point.giftCount) : undefined,
    donationCount: Number.isFinite(Number(point.donationCount)) ? Number(point.donationCount) : undefined,
  }));
}

interface DesignationResponse {
  slices?: DesignationSlice[];
  total?: number | string;
}

function normalizeDonationList(input: DonationListResponse | DonationPreview[] | null | undefined): DonationPreview[] {
  if (Array.isArray(input)) return input;
  return input?.items ?? input?.donations ?? [];
}

function normalizeCampaignList(input: CampaignImpact[] | { campaigns?: CampaignImpact[]; items?: CampaignImpact[] } | null | undefined): CampaignImpact[] {
  if (Array.isArray(input)) return input;
  return input?.campaigns ?? input?.items ?? [];
}

function rejectedMessage(label: string, result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== "rejected") return null;
  const detail = result.reason instanceof Error ? result.reason.message : "Request failed.";
  return `${label}: ${detail}`;
}

export async function loadDonorDashboardData(input: {
  reportingYearMode: string;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
}): Promise<DashboardData> {
  const [appearanceResult, donationsResult, trendResult, designationResult, campaignsResult] = await Promise.allSettled([
    apiFetch<Partial<DashboardAppearanceSettings>>("/api/settings/dashboard-appearance"),
    apiFetch<DonationListResponse | DonationPreview[]>("/api/donations?limit=20&status=COMPLETED"),
    apiFetch<TrendResponse>(`/api/reports/giving-trend?dateBasis=${encodeURIComponent(input.reportingYearMode)}`),
    apiFetch<DesignationResponse>(`/api/reports/designations-summary?dateBasis=${encodeURIComponent(input.reportingYearMode)}`),
    apiFetch<CampaignImpact[] | { campaigns?: CampaignImpact[]; items?: CampaignImpact[] }>("/api/campaigns?active=true&limit=6"),
  ]);

  const appearance = appearanceResult.status === "fulfilled"
    ? normalizeDashboardAppearanceSettings(appearanceResult.value)
    : normalizeDashboardAppearanceSettings(null);

  const trend = trendResult.status === "fulfilled" ? trendResult.value : null;
  const designations = designationResult.status === "fulfilled" ? designationResult.value : null;

  return {
    period: appearance.defaultPeriod,
    appearance,
    recentDonations: donationsResult.status === "fulfilled" ? normalizeDonationList(donationsResult.value) : [],
    trendPoints: normalizeTrendPoints(trend?.points),
    trendTotal: toDashboardNumber(trend?.total),
    trendGiftCount: trend?.giftCount ?? 0,
    trendPercent: trend?.trendPercent ?? null,
    designationSlices: designations?.slices ?? [],
    designationTotal: toDashboardNumber(designations?.total),
    campaigns: campaignsResult.status === "fulfilled" ? normalizeCampaignList(campaignsResult.value) : [],
    stewardshipAlerts: buildStewardshipSuggestions(input.summary, input.retention),
    errors: [
      rejectedMessage("Dashboard appearance", appearanceResult),
      rejectedMessage("Recent donor movement", donationsResult),
      rejectedMessage("Giving trend", trendResult),
      rejectedMessage("Giving by designation", designationResult),
      rejectedMessage("Campaign impact", campaignsResult),
    ].filter((message): message is string => Boolean(message)),
  };
}
