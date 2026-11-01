"use client";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import DashboardWidgetRenderer from "./DashboardWidgetRenderer";
import type { useDashboardPageState } from "./useDashboardPageState";

export default function DashboardInsights({dashboardState, insightsExpanded, setInsightsExpanded}: {
  dashboardState: ReturnType<typeof useDashboardPageState>;
  insightsExpanded: boolean;
  setInsightsExpanded: (open: boolean) => void;
}) {
  const showInsights = insightsExpanded || dashboardState.editMode;
  return (
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
              setInsightsExpanded(!showInsights);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0f6cbd] hover:text-[#0f548c]"
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
              key={id}
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
                refreshVersion: dashboardState.refreshVersion,
                onRetry: dashboardState.load,
              }}
            />
          ))}
        </div>
      </div> : null}
    </section>
  );

}
