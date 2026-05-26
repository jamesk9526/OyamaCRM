/**
 * NaturalisticDonorDashboard — the naturalistic mission-portal dashboard for OyamaCRM Donor CRM.
 * This replaces DonorDashboardVisualRefresh in app/page.tsx.
 * Uses a full-width hero with configurable image, floating impact band, and editorial-style sections.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { DASHBOARD_APPEARANCE_DEFAULTS } from "@/app/features/donor-dashboard/dashboard-config";
import { formatDashboardCompactCurrency, toDashboardNumber } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";
import { loadDonorDashboardData } from "@/app/features/donor-dashboard/services/dashboard-client-service";
import type { CampaignImpact, DashboardData, DonationPreview, DonorDashboardSummary, RetentionData } from "@/app/features/donor-dashboard/types";
import DonorHero from "./naturalistic/DonorHero";
import ImpactSummaryBand from "./naturalistic/ImpactSummaryBand";
import DonorMovementFeed from "./naturalistic/DonorMovementFeed";
import GivingTrendChart from "./naturalistic/GivingTrendChart";
import GivingDesignationChart from "./naturalistic/GivingDesignationChart";
import StewardSuggestions from "./naturalistic/StewardSuggestions";
import CampaignImpactCards from "./naturalistic/CampaignImpactCards";
import RetentionSnapshotCard from "./naturalistic/RetentionSnapshotCard";
import MyDueTasksCard from "./naturalistic/MyDueTasksCard";
import DashboardCustomizerPanel from "./DashboardCustomizerPanel";
import { useDashboardPreferences } from "./useDashboardPreferences";

interface NaturalisticDonorDashboardProps {
  greeting: string;
  name: string;
  loading: boolean;
  summary: DonorDashboardSummary | null;
  retention: RetentionData | null;
  revenueGoal: number;
  dataThroughLabel: string;
  reportingYearMode: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NaturalisticDonorDashboard({
  greeting,
  name,
  loading: summaryLoading,
  summary,
  retention,
  revenueGoal,
  dataThroughLabel,
  reportingYearMode,
}: NaturalisticDonorDashboardProps) {
  const { user } = useAuth();
  const userId = user?.id ?? undefined;
  const isAdmin = user?.role === "admin";

  // Per-user dashboard preferences (localStorage)
  const { prefs, update: updatePrefs, reset: resetPrefs } = useDashboardPreferences(userId);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Rich dashboard data fetched through the dashboard service rather than inside cards.
  const [appearance, setAppearance] = useState(DASHBOARD_APPEARANCE_DEFAULTS);
  const [donations, setDonations] = useState<DonationPreview[]>([]);
  const [trendPoints, setTrendPoints] = useState<DashboardData["trendPoints"]>([]);
  const [trendTotal, setTrendTotal] = useState(0);
  const [trendGiftCount, setTrendGiftCount] = useState(0);
  const [trendPercent, setTrendPercent] = useState<number | null>(null);
  const [designationSlices, setDesignationSlices] = useState<DashboardData["designationSlices"]>([]);
  const [designationTotal, setDesignationTotal] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignImpact[]>([]);
  const [suggestions, setSuggestions] = useState<DashboardData["stewardshipAlerts"]>([]);
  const [richLoading, setRichLoading] = useState(true);

  const loadRichData = useCallback(async () => {
    setRichLoading(true);
    try {
      const data = await loadDonorDashboardData({ reportingYearMode, summary, retention });
      setAppearance(data.appearance);
      setDonations(data.recentDonations);
      setTrendPoints(data.trendPoints);
      setTrendTotal(data.trendTotal);
      setTrendGiftCount(data.trendGiftCount);
      setTrendPercent(data.trendPercent);
      setDesignationSlices(data.designationSlices);
      setDesignationTotal(data.designationTotal);
      setCampaigns(data.campaigns);
      setSuggestions(data.stewardshipAlerts);
    } catch {
      // Soft fail — each sub-component handles empty states
    } finally {
      setRichLoading(false);
    }
  }, [reportingYearMode, retention, summary]);

  useEffect(() => {
    loadRichData();
  }, [loadRichData]);

  // Impact band values come only from calculated API data. Missing data renders as an empty value.
  const totalYtdGiving = trendTotal > 0 ? formatDashboardCompactCurrency(trendTotal) : "—";
  const actualMonthly = summary ? formatDashboardCompactCurrency(toDashboardNumber(summary.monthAmount)) : "—";
  const activeDonors = summary ? (summary.activeDonors ?? 0).toLocaleString() : "—";
  const newDonors = summary ? summary.newDonorsThisMonth.toLocaleString() : "—";
  const followUps = summary ? (summary.pendingTasks + summary.overdueTasks).toLocaleString() : "—";
  const retentionRate = retention ? `${Math.round(retention.rate)}%` : "—";
  const showStewardSuggestions = prefs.showStewardSuggestions && appearance.showStewardSuggestions;
  const showMovementFeed = prefs.showMovementFeed && appearance.showRecentDonorMovement;
  const showCampaignCards = prefs.showCampaignCards && appearance.showCampaignImpactCards && appearance.showProjectsAndInitiatives;
  const contentGapClass = appearance.density === "compact" ? "space-y-5" : "space-y-8";

  return (
    <div
      className="min-h-screen"
      style={{ background: "#FAFAF7" }}
    >
      {/* ① Natural hero header with inline edit button */}
      <DonorHero
        greeting={greeting}
        name={name}
        appearance={appearance}
        headerImageOverride={prefs.headerImageUrl || null}
        onEditHeader={() => setCustomizerOpen(true)}
      />

      {/* ② Floating impact summary band (overlaps hero) */}
      {prefs.showImpactBand && (
        <ImpactSummaryBand
          loading={summaryLoading}
          totalGiving={totalYtdGiving}
          activeDonors={activeDonors}
          newDonors={newDonors}
          followUpsNeeded={followUps}
          retentionRate={retentionRate}
          monthlyGiving={actualMonthly}
          momTrend={summary?.momTrend}
        />
      )}

      {/* ③ Main content grid */}
      <div className={`mx-auto mt-8 max-w-[1560px] ${contentGapClass} px-4 pb-16 sm:px-6`}>

        {/* Row 1: 3-column — Steward Intelligence | Donor Movement | Designation + Retention */}
        {(showStewardSuggestions || showMovementFeed || prefs.showDesignationChart || prefs.showRetentionSnapshot) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1.5fr_1.1fr]">
            {/* Col 1: Steward Intelligence */}
            {showStewardSuggestions ? (
              <StewardSuggestions suggestions={suggestions} loading={summaryLoading} />
            ) : (
              <div />
            )}

            {/* Col 2: Recent donor movement */}
            {showMovementFeed ? (
              <DonorMovementFeed donations={donations} loading={richLoading} />
            ) : (
              <div />
            )}

            {/* Col 3: Designation chart stacked above Retention snapshot */}
            <div className="space-y-6">
              {prefs.showDesignationChart && (
                <GivingDesignationChart
                  slices={designationSlices}
                  total={designationTotal}
                  loading={richLoading}
                />
              )}
              {prefs.showRetentionSnapshot && (
                <RetentionSnapshotCard retention={retention} loading={summaryLoading} />
              )}
            </div>
          </div>
        )}

        {/* Row 2 (optional): Giving trend — full width */}
        {prefs.showGivingTrend && (
          <GivingTrendChart
            points={trendPoints}
            total={trendTotal}
            giftCount={trendGiftCount}
            loading={richLoading}
            rangeLabel={dataThroughLabel}
            trendPercent={trendPercent}
          />
        )}

        {/* Row 3: Campaigns (wider) | My Due Tasks */}
        {(showCampaignCards || prefs.showMyDueTasks) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
            {showCampaignCards && (
              <CampaignImpactCards campaigns={campaigns} loading={richLoading} />
            )}
            {prefs.showMyDueTasks && (
              <MyDueTasksCard />
            )}
          </div>
        )}

        {/* Empty state when all widgets are off */}
        {!prefs.showImpactBand && !prefs.showStewardSuggestions && !prefs.showMovementFeed &&
          !prefs.showGivingTrend && !prefs.showDesignationChart && !prefs.showCampaignCards &&
          !prefs.showRetentionSnapshot && !prefs.showMyDueTasks && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-500">All widgets are hidden</p>
            <p className="mt-1 text-sm text-slate-400">Use the Customize button to turn widgets back on.</p>
            <button
              type="button"
              onClick={() => setCustomizerOpen(true)}
              className="mt-4 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 transition"
            >
              Customize Dashboard
            </button>
          </div>
        )}
      </div>

      {/* Dashboard customizer panel */}
        <DashboardCustomizerPanel
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        prefs={prefs}
        onUpdate={updatePrefs}
        onReset={resetPrefs}
        isAdmin={isAdmin}
        orgHeaderImageUrl={appearance.headerImageUrl}
      />
    </div>
  );
}
