/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Relationships, follow-up, and preserved customizable insight widgets.
 */
"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMSecondaryMenu from "@/app/components/ui/crm/CRMSecondaryMenu";
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
        {dashboardState.editMode ? <div className="mb-4 rounded-lg border border-[#cfe4fa] bg-[#eff6fc] px-3 py-2.5 text-xs text-[#0f548c]">Drag a widget by its header or use the arrow controls. Size changes are saved automatically in this browser.</div> : null}

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
    <EnterprisePageShell>
      <NaturalisticDonorDashboard
        greeting={greeting}
        name={name}
        loadError={dashboardState.loadError}
        loading={dashboardState.loading}
        summary={dashboardState.summary ?? null}
        retention={dashboardState.retention ?? null}
        revenueGoal={dashboardState.revenueGoal}
        dataThroughLabel={dashboardState.dataThroughLabel}
        reportingYearMode={dashboardState.reportingYearMode}
        onRefresh={dashboardState.load}
        headerActions={(
          <CRMSecondaryMenu label="Dashboard options">
            <button type="button" className="donor-button" onClick={dashboardState.openCustomizeModal}>Customize dashboard</button>
            <button type="button" className="donor-button" onClick={dashboardState.toggleLayoutLock}>{dashboardState.locked ? "Unlock layout" : "Lock layout"}</button>
            <button type="button" className="donor-button" disabled={dashboardState.locked} onClick={() => { setInsightsExpanded(true); dashboardState.toggleEditMode(); }}>{dashboardState.editMode ? "Done arranging" : "Reorder widgets"}</button>
            <button type="button" className="donor-button" onClick={() => dashboardState.applySmartLayout("FEATURE_FIRST")}>Smart layout</button>
            <button type="button" className="donor-button" onClick={dashboardState.resetLayout}>Reset widget layout</button>
          </CRMSecondaryMenu>
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

