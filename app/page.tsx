/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Relationships, follow-up, and preserved customizable insight widgets.
 */
"use client";

import "./components/dashboard/dashboard.css";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import NaturalisticDonorDashboard from "./components/dashboard/NaturalisticDonorDashboard";
import DashboardLayoutModal from "./components/dashboard/DashboardLayoutModal";
import DashboardInsights from "./components/dashboard/DashboardInsights";
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


  return (
    <EnterprisePageShell>
      <NaturalisticDonorDashboard
        greeting={greeting}
        name={name}
        loadError={dashboardState.loadError}
        loading={dashboardState.loading}
        summary={dashboardState.summary ?? null}
        retention={dashboardState.retention ?? null}
        data={dashboardState.data}
        requestError={dashboardState.detailsError}
        refreshVersion={dashboardState.refreshVersion}
        dataThroughLabel={dashboardState.dataThroughLabel}
        onRefresh={dashboardState.load}
        headerActions={(
          <button type="button" className="donor-button" onClick={dashboardState.openCustomizeModal}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Customize dashboard</button>
        )}
        extraSections={<div id="dashboard-insights"><DashboardInsights dashboardState={dashboardState} insightsExpanded={insightsExpanded} setInsightsExpanded={setInsightsExpanded} /></div>}
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
          initialLocked={dashboardState.locked}
          onArrangeWidgets={() => { setInsightsExpanded(true); dashboardState.beginEditMode(); }}
        />
      ) : null}
    </EnterprisePageShell>
  );
}

