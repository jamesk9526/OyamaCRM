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
    <section className="mt-4 min-w-0 rounded-[26px] border border-white/80 bg-white/60 p-3.5 shadow-[0_18px_48px_rgba(15,23,42,0.075),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3 px-1 sm:items-center">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Dashboard Widgets</h2>
          <p className="text-xs text-slate-500">Organize, enable, and configure your personal dashboard layout.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {dashboardState.visibleWidgetOrder.length} active
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
              document.getElementById("dashboard-widgets")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "steward-recommendations": dashboardState.enableAiWidgets,
            "giving-trends": () => {
              document.getElementById("dashboard-widgets")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "donor-activity": () => {
              document.getElementById("dashboard-widgets")?.scrollIntoView({ behavior: "smooth", block: "start" });
            },
            "campaign-health": () => {
              document.getElementById("dashboard-widgets")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3.5 text-xs font-semibold text-emerald-800 shadow-[0_6px_16px_rgba(5,150,105,0.1)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
            aria-label="Customize dashboard"
          >
            Customize
          </button>
        )}
        extraSections={<div id="dashboard-widgets">{widgetArea}</div>}
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

