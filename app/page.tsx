/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Renders the naturalistic mission-portal experience with configurable hero image,
 * floating impact band, steward intelligence, giving charts, and campaign cards.
 */
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
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
    <section className="mt-4 rounded-2xl border border-slate-200/90 bg-white/60 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard Widgets</h2>
          <p className="text-xs text-slate-500">Organize, enable, and configure your personal dashboard layout.</p>
        </div>
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
    <>
      <NaturalisticDonorDashboard
        greeting={greeting}
        name={name}
        loading={dashboardState.loading}
        summary={dashboardState.summary ?? null}
        retention={dashboardState.retention ?? null}
        revenueGoal={dashboardState.revenueGoal}
        dataThroughLabel={dashboardState.dataThroughLabel}
        reportingYearMode={dashboardState.reportingYearMode}
        headerActions={(
          <button
            type="button"
            onClick={dashboardState.openCustomizeModal}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
            aria-label="Customize dashboard"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1 1 0 0 1 1.35-.936l1.1.445a1 1 0 0 0 .75 0l1.1-.445a1 1 0 0 1 1.35.936l.08 1.183a1 1 0 0 0 .568.84l1.06.54a1 1 0 0 1 .486 1.3l-.447 1.097a1 1 0 0 0 0 .75l.447 1.097a1 1 0 0 1-.486 1.3l-1.06.54a1 1 0 0 0-.568.84l-.08 1.183a1 1 0 0 1-1.35.936l-1.1-.445a1 1 0 0 0-.75 0l-1.1.445a1 1 0 0 1-1.35-.936l-.08-1.183a1 1 0 0 0-.568-.84l-1.06-.54a1 1 0 0 1-.486-1.3l.447-1.097a1 1 0 0 0 0-.75l-.447-1.097a1 1 0 0 1 .486-1.3l1.06-.54a1 1 0 0 0 .568-.84l.08-1.183z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
            </svg>
            Customize Dashboard
          </button>
        )}
        extraSections={widgetArea}
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
    </>
  );
}

