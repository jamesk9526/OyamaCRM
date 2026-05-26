/**
 * Dashboard page — OyamaCRM Donor CRM home screen.
 * Renders the naturalistic mission-portal experience with configurable hero image,
 * floating impact band, steward intelligence, giving charts, and campaign cards.
 */
"use client";

import { useAuth } from "@/app/components/auth/AuthProvider";
import NaturalisticDonorDashboard from "./components/dashboard/NaturalisticDonorDashboard";
import { useDashboardPageState } from "./components/dashboard/useDashboardPageState";

export default function DashboardPage() {
  const { user } = useAuth();
  const dashboardState = useDashboardPageState();

  /** Time-of-day greeting */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = user ? `${user.firstName} ${user.lastName}` : "…";

  return (
    <NaturalisticDonorDashboard
      greeting={greeting}
      name={name}
      loading={dashboardState.loading}
      summary={dashboardState.summary ?? null}
      retention={dashboardState.retention ?? null}
      revenueGoal={dashboardState.revenueGoal}
      dataThroughLabel={dashboardState.dataThroughLabel}
      reportingYearMode={dashboardState.reportingYearMode}
    />
  );
}

