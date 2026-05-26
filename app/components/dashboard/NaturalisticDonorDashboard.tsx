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
import GiftAcknowledgmentQueue from "./naturalistic/GiftAcknowledgmentQueue";
import GivingSourceMixCard from "./naturalistic/GivingSourceMixCard";
import DonorHealthSnapshot from "./naturalistic/DonorHealthSnapshot";
import ThisMonthsDonorsCard from "./naturalistic/ThisMonthsDonorsCard";
import RestoredDashboardWidgets from "./naturalistic/RestoredDashboardWidgets";
import DashboardSectionHeader from "./naturalistic/DashboardSectionHeader";
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
  const [sectionErrors, setSectionErrors] = useState<string[]>([]);
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
      setSectionErrors(data.errors);
    } catch {
      setSectionErrors(["Dashboard data could not be refreshed. Existing empty states remain visible."]);
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
  const showThisMonthsDonors = prefs.showThisMonthsDonors && appearance.showThisMonthsDonors;
  const showFollowUpWidgets = prefs.showFollowUpWidgets && appearance.showFollowUpWidgets;
  const showExpandedWidgets = prefs.showExpandedWidgets && appearance.showExpandedWidgets;
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
      {prefs.showImpactBand && appearance.showMetricCards && (
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
        {sectionErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Some dashboard sections could not refresh.</p>
            <p className="mt-1 text-xs text-amber-800">{sectionErrors.slice(0, 2).join(" ")}</p>
          </div>
        ) : null}

        {/* Row 1: 3-column — Steward Intelligence | Donor Movement | Designation + Retention */}
        {(showStewardSuggestions || showMovementFeed || prefs.showDesignationChart || prefs.showRetentionSnapshot) && (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="Today"
              title="Stewardship Command Center"
              description="The first view focuses staff on urgent follow-up, current donor movement, fund allocation, and retention health."
            />
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
          </section>
        )}

        {showThisMonthsDonors ? (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="This month"
              title="Who Gave This Month"
              description="Open the current-month donor list, create stewardship tasks, save an email audience, or start thank-you communications from live gift data."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <ThisMonthsDonorsCard />
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-950 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Suggested workflow</p>
                <h3 className="mt-2 text-base font-bold text-slate-950">Turn monthly giving into care</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review donors who gave this month, select the donors needing follow-up, then save a task or audience list for thank-you letters and email outreach.
                </p>
                <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-700">
                  <span className="rounded-xl bg-white/80 px-3 py-2">1. Review donor totals and latest gift dates</span>
                  <span className="rounded-xl bg-white/80 px-3 py-2">2. Save a follow-up task for selected donors</span>
                  <span className="rounded-xl bg-white/80 px-3 py-2">3. Create an audience list for thank-you messages</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {showFollowUpWidgets ? (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="Follow-up"
              title="Donor Care and Gift Operations"
              description="These widgets surface receipts, thank-yous, payment mix, and health signals from live donor activity."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <GiftAcknowledgmentQueue donations={donations} loading={richLoading} />
              <GivingSourceMixCard donations={donations} loading={richLoading} />
              <DonorHealthSnapshot summary={summary} retention={retention} loading={summaryLoading} />
            </div>
          </section>
        ) : null}

        {/* Row 2 (optional): Giving trend — full width */}
        {prefs.showGivingTrend && (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="Giving"
              title="Fundraising Momentum"
              description="Track completed giving over time without forecasts or placeholder values."
            />
            <GivingTrendChart
              points={trendPoints}
              total={trendTotal}
              giftCount={trendGiftCount}
              loading={richLoading}
              rangeLabel={dataThroughLabel}
              trendPercent={trendPercent}
            />
          </section>
        )}

        {showExpandedWidgets ? (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="Expanded"
              title="Restored Stewardship Widgets"
              description="Additional dashboard panels for top donors, recent gifts, meetings, workload, campaign health, and fundraising pace."
            />
            <RestoredDashboardWidgets
              summary={summary}
              retention={retention}
              campaigns={campaigns}
              trendTotal={trendTotal}
              revenueGoal={revenueGoal}
              loading={summaryLoading || richLoading}
            />
          </section>
        ) : null}

        {/* Row 3: Campaigns (wider) | My Due Tasks */}
        {(showCampaignCards || prefs.showMyDueTasks) && (
          <section className="space-y-4">
            <DashboardSectionHeader
              eyebrow="Next"
              title="Campaign Progress and Personal Work"
              description="Connect campaign outcomes with the tasks assigned to the current staff member."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
              {showCampaignCards && (
                <CampaignImpactCards campaigns={campaigns} loading={richLoading} />
              )}
              {prefs.showMyDueTasks && (
                <MyDueTasksCard />
              )}
            </div>
          </section>
        )}

        {/* Empty state when all widgets are off */}
        {(!prefs.showImpactBand || !appearance.showMetricCards) && !prefs.showStewardSuggestions && !prefs.showMovementFeed && !prefs.showThisMonthsDonors && !prefs.showFollowUpWidgets &&
          !prefs.showGivingTrend && !prefs.showDesignationChart && !prefs.showExpandedWidgets && !prefs.showCampaignCards &&
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
