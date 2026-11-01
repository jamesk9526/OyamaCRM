"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredReportingYearMode, type ReportingYearMode } from "@/app/lib/fiscal-year";
import { loadDonorDashboardCoreMetrics, loadDonorDashboardData, type DashboardCoreMetrics } from "./services/dashboard-client-service";
import type { DashboardData } from "./types";

interface Snapshot {
  mode: ReportingYearMode;
  metrics: DashboardCoreMetrics;
  details: DashboardData | null;
  error: string | null;
  refreshed: Date;
}

/** Coordinates the dashboard snapshot and ignores superseded/unmounted requests. */
export function useDonorDashboardData() {
  const [reportingYearMode, setMode] = useState<ReportingYearMode>(getStoredReportingYearMode);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    const [core, details] = await Promise.allSettled([
      loadDonorDashboardCoreMetrics(reportingYearMode),
      loadDonorDashboardData({ reportingYearMode }),
    ]);
    if (id !== request.current) return;
    setSnapshot({
      mode: reportingYearMode,
      metrics: core.status === "fulfilled" ? core.value : { summary: null, retention: null, errors: ["Dashboard metrics could not be loaded."] },
      details: details.status === "fulfilled" ? details.value : null,
      error: details.status === "rejected" ? "Dashboard details could not be loaded." : null,
      refreshed: new Date(),
    });
    setLoading(false);
  }, [reportingYearMode]);
  useEffect(() => { void load(); return () => { request.current += 1; }; }, [load]);
  useEffect(() => {
    const changed = () => setMode(getStoredReportingYearMode());
    window.addEventListener("reporting-year-mode:changed", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("reporting-year-mode:changed", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  const current = snapshot?.mode === reportingYearMode ? snapshot : null;
  const refresh = useCallback(async () => { setRefreshVersion(value => value + 1); await load(); }, [load]);
  const summary = current?.metrics.summary ?? null;
  const through = summary?.freshness?.dataThrough;
  return {
    summary, retention: current?.metrics.retention ?? null,
    data: current?.details ?? null,
    loading: loading || !current,
    loadError: current?.metrics.errors.join(" ") || null,
    detailsError: current?.error ?? null,
    reportingYearMode, refreshVersion, load: refresh,
    dataThroughLabel: through
      ? `Data through ${new Date(through).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : current ? `Refreshed ${current.refreshed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Loading data...",
  };
}
