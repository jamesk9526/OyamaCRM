/**
 * Dashboard page — OyamaCRM home screen.
 * Displays a real-time snapshot of org health: revenue, retention, tasks, giving trends,
 * recent donations, and top donors.
 *
 * The default view uses a fixed visual-refresh layout. Legacy widget layout settings
 * remain persisted so the customization modal can continue reading existing preferences.
 */
"use client";

import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import DonorDashboardVisualRefresh from "./components/dashboard/DonorDashboardVisualRefresh";
import EnterprisePageShell from "./components/layout/EnterprisePageShell";
import { useDashboardPageState } from "./components/dashboard/useDashboardPageState";

export default function DashboardPage() {
  const { user } = useAuth();
  const dashboardState = useDashboardPageState();

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  return (
    <EnterprisePageShell maxWidthClassName="max-w-[1560px]">
      <div className="space-y-5">
        <DonorDashboardVisualRefresh
          greeting={greeting}
          name={name}
          loading={dashboardState.loading}
          dataThroughLabel={dashboardState.dataThroughLabel}
          totalConstituents={dashboardState.summary?.totalConstituents ?? 0}
          monthAmount={dashboardState.summary?.monthAmount ?? 0}
          monthTrend={dashboardState.summary?.momTrend ?? null}
          revenueGoal={dashboardState.revenueGoal}
          retentionRate={dashboardState.retention?.rate ?? 0}
          retentionRetained={dashboardState.retention?.retained ?? 0}
          retentionTotal={dashboardState.retention?.total ?? 0}
          pendingTasks={dashboardState.summary?.pendingTasks ?? 0}
          overdueTasks={dashboardState.summary?.overdueTasks ?? 0}
          activeCampaigns={dashboardState.summary?.activeCampaigns ?? 0}
          newDonorsThisMonth={dashboardState.summary?.newDonorsThisMonth ?? 0}
          reportingYearMode={dashboardState.reportingYearMode}
          onRefresh={() => void dashboardState.load()}
        />

      {dashboardState.loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dashboard data is partially unavailable. {dashboardState.loadError}
        </div>
      )}

      {!dashboardState.loading && !dashboardState.summary && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-blue-900">No dashboard data yet</h2>
          <p className="text-sm text-blue-800 mt-1">
            Start by adding a donor and recording your first donation, then refresh this page to load live metrics.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/constituents" className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Add donor
            </Link>
            <Link href="/donations/new" className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Record donation
            </Link>
            <button onClick={() => void dashboardState.load()} className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-100">
              Refresh dashboard
            </button>
          </div>
        </section>
      )}

      </div>
    </EnterprisePageShell>
  );
}

