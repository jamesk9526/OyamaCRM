/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Renders the naturalistic mission-portal experience with configurable hero image,
 * floating impact band, steward intelligence, giving charts, and campaign cards.
 */
"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
import NaturalisticDonorDashboard from "./components/dashboard/NaturalisticDonorDashboard";
import DashboardLayoutModal from "./components/dashboard/DashboardLayoutModal";
import DashboardWidgetRenderer from "./components/dashboard/DashboardWidgetRenderer";
import { WIDGET_META } from "./components/dashboard/dashboardPageConfig";
import { useDashboardPageState } from "./components/dashboard/useDashboardPageState";

export default function DashboardPage() {
  const { user } = useAuth();
  const dashboardState = useDashboardPageState();
  const [insightsExpanded, setInsightsExpanded] = useState(false);

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  const showInsights = insightsExpanded || dashboardState.editMode;
  const widgetArea = (
    <section className="crm-card-surface mt-5 min-w-0 rounded-xl border">
      <div className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${showInsights ? "border-b border-slate-200" : ""}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">More dashboard tools</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Detailed insights</h2>
          <p className="mt-1 text-xs text-slate-500">Open the reports, queues, and charts selected for this dashboard.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showInsights ? <button type="button" onClick={dashboardState.toggleLayoutLock} className="hidden min-h-8 items-center rounded-[2px] px-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:inline-flex" title={dashboardState.locked ? "Unlock dashboard layout" : "Lock dashboard layout"}>{dashboardState.locked ? "Layout locked" : "Lock layout"}</button> : null}
          {showInsights ? <button type="button" onClick={dashboardState.toggleEditMode} disabled={dashboardState.locked} className={`inline-flex min-h-8 items-center rounded-[2px] border px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${dashboardState.editMode ? "border-[#0f6cbd] bg-[#eff6fc] text-[#0f548c]" : "border-slate-200 bg-white text-slate-700 hover:border-[#0f6cbd]"}`}>
            {dashboardState.editMode ? "Done arranging" : "Reorder"}
          </button> : null}
          <button
            type="button"
            aria-expanded={showInsights}
            aria-controls="dashboard-detailed-insights"
            onClick={() => {
              if (dashboardState.editMode) dashboardState.toggleEditMode();
              setInsightsExpanded((current) => !current);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-[2px] border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0f6cbd] hover:text-[#0f548c]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {showInsights ? "Hide details" : `Show ${dashboardState.visibleWidgetOrder.length} widgets`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showInsights ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showInsights ? <span className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 lg:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {dashboardState.visibleWidgetOrder.length} widgets
          </span> : null}
        </div>
      </div>

      {showInsights ? <div id="dashboard-detailed-insights" className="p-4 sm:p-5">
        {dashboardState.editMode ? <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-[#cfe4fa] bg-[#eff6fc] px-3 py-2.5 text-xs text-[#0f548c]"><span>Drag a widget by its header or use the arrow controls. Size changes are saved automatically in this browser.</span><button type="button" onClick={dashboardState.openCustomizeModal} className="font-semibold underline underline-offset-2">Open full customization</button></div> : null}

        <div className={dashboardState.sectionLayoutClassName}>
          {dashboardState.visibleWidgetOrder.map((id, idx) => (
            <DashboardWidgetRenderer
              key={`${id}-${idx}`}
              id={id}
              frame={dashboardState.getWidgetFrameProps(id, idx)}
              data={{
                aiWidgetsEnabled: dashboardState.aiWidgetsEnabled,
                onToggleAiWidgets: dashboardState.setAiWidgetsEnabled,
                onEnableAiWidgets: dashboardState.enableAiWidgets,
                reportingYearMode: dashboardState.reportingYearMode,
                includeGrants: dashboardState.includeGrants,
                onToggleGrants: dashboardState.toggleGrants,
                revenueGoalMode: dashboardState.revenueGoalMode,
                revenueProgressSource: dashboardState.revenueProgressSource,
                summary: dashboardState.summary,
                retention: dashboardState.retention,
                loading: dashboardState.loading,
                revenueGoal: dashboardState.revenueGoal,
              }}
            />
          ))}
        </div>
      </div> : null}
    </section>
  );

  return (
    <EnterprisePageShell
      ribbon={(
        <CRMActionBar
          context={{
            flags: {
              dashboardEditMode: dashboardState.editMode,
            },
          }}
          commandHandlers={{
            "refresh-dashboard": () => {
              void dashboardState.load();
            },
            "customize-dashboard": dashboardState.openCustomizeModal,
            "quick-add": () => {
              window.location.href = "/constituents/new";
            },
            "needs-attention": () => {
              document.getElementById("dashboard-insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "steward-recommendations": dashboardState.enableAiWidgets,
            "giving-trends": () => {
              document.getElementById("dashboard-insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "donor-activity": () => {
              document.getElementById("dashboard-insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "campaign-health": () => {
              document.getElementById("dashboard-insights")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "card-layout": () => dashboardState.applySmartLayout("BALANCED"),
            "compact-layout": dashboardState.openCustomizeModal,
            "toggle-widgets": dashboardState.openCustomizeModal,
            "reset-layout": dashboardState.resetLayout,
          }}
        />
      )}
    >
      <NaturalisticDonorDashboard
        greeting={greeting}
        name={name}
        loading={dashboardState.loading}
        summary={dashboardState.summary ?? null}
        retention={dashboardState.retention ?? null}
        revenueGoal={dashboardState.revenueGoal}
        dataThroughLabel={dashboardState.dataThroughLabel}
        reportingYearMode={dashboardState.reportingYearMode}
        onRefresh={dashboardState.load}
        headerActions={(
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => dashboardState.applySmartLayout("FEATURE_FIRST")} className="hidden min-h-9 items-center rounded-[2px] border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-[#0f6cbd] hover:text-[#0f548c] sm:inline-flex">Smart layout</button>
            <button
              type="button"
              onClick={dashboardState.openCustomizeModal}
              className="inline-flex min-h-9 items-center rounded-[2px] border border-[#0f6cbd] bg-[#0f6cbd] px-3.5 text-xs font-semibold text-white transition hover:bg-[#115ea3]"
              aria-label="Customize dashboard"
            >
              Customize
            </button>
          </div>
        )}
        extraSections={<div id="dashboard-insights">{widgetArea}</div>}
      />

      {dashboardState.showCustomizeModal ? (
        <DashboardLayoutModal
          order={dashboardState.widgetOrder}
          widgetMeta={WIDGET_META}
          onApply={dashboardState.applyCustomizeSettings}
          onClose={dashboardState.closeCustomizeModal}
          initialRevenueProgressSource={dashboardState.revenueProgressSource}
          initialIncludeGrants={dashboardState.includeGrants}
          initialRevenueGoalMode={dashboardState.revenueGoalMode}
          initialManualRevenueGoalAmount={dashboardState.manualRevenueGoalAmount}
          initialHiddenWidgetIds={dashboardState.hiddenWidgets}
          initialWidgetSizes={dashboardState.widgetSizes}
          initialLayoutMode={dashboardState.layoutMode}
          initialAutoArrangePreset={dashboardState.autoArrangePreset}
        />
      ) : null}
    </EnterprisePageShell>
  );
}

