/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Renders the naturalistic mission-portal experience with configurable hero image,
 * floating impact band, steward intelligence, giving charts, and campaign cards.
 */
"use client";

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

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  const widgetArea = (
    <section className="crm-card-surface mt-5 min-w-0 rounded-xl border p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3 px-1 sm:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Optional intelligence</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Performance workspace</h2>
          <p className="mt-1 text-xs text-slate-500">Add deeper analysis here when your team needs more than the core operating view.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {dashboardState.visibleWidgetOrder.length} insights
        </span>
      </div>

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
            "card-layout": dashboardState.showAllWidgets,
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
          <button
            type="button"
            onClick={dashboardState.openCustomizeModal}
            className="inline-flex min-h-9 items-center rounded-[2px] border border-[#0f6cbd] bg-[#0f6cbd] px-3.5 text-xs font-semibold text-white transition hover:bg-[#115ea3]"
            aria-label="Customize dashboard"
          >
            Customize
          </button>
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
        />
      ) : null}
    </EnterprisePageShell>
  );
}

