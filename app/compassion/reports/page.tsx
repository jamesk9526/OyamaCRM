// Compassion CRM Reports page — live KPI and distribution reporting for client-care operations.
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ReportCountRow {
  label: string;
  value: number;
}

interface RecentCase {
  id: string;
  caseNumber: string;
  caseType: string;
  caseStatus: string;
  openedAt: string;
  clientName: string;
}

interface ReportsSummary {
  generatedAt: string;
  kpis: {
    totalClients: number;
    activeCases: number;
    newClientsThisMonth: number;
    appointmentsThisMonth: number;
    appointmentsLastMonth: number;
    completedAppointmentsThisMonth: number;
    completionRate: number;
    monthDeltaPercent: number;
  };
  casesByType: ReportCountRow[];
  casesByStatus: ReportCountRow[];
  appointmentsByType: ReportCountRow[];
  recentCases: RecentCase[];
}

/** Formats enum-like labels into title case words. */
function humanize(label: string): string {
  return label
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Renders a simple bar list for distribution data. */
function DistributionCard({ title, rows }: { title: string; rows: ReportCountRow[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400">No data available.</p>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-600">{humanize(row.label)}</p>
                <p className="text-xs font-medium text-gray-800">{row.value}</p>
              </div>
              <div className="h-2 rounded-full bg-blue-50 overflow-hidden">
                <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * CompassionReportsPage provides operational reporting for client-care teams.
 * Access enforcement is handled by CompassionLayout and /api/compassion middleware.
 */
export default function CompassionReportsPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ReportsSummary>("/api/compassion/reports/summary");
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl">📊</div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">Live caseload, appointment, and growth metrics for Compassion CRM.</p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400 animate-pulse">
          Loading report data...
        </div>
      ) : !summary ? (
        <div className="bg-white rounded-xl border border-dashed border-blue-200 p-10 text-center text-sm text-gray-500">
          Report data is unavailable right now.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Clients</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{summary.kpis.totalClients}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Active Cases</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{summary.kpis.activeCases}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Appointments This Month</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{summary.kpis.appointmentsThisMonth}</p>
              <p className={`text-xs mt-1 ${summary.kpis.monthDeltaPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {summary.kpis.monthDeltaPercent >= 0 ? "+" : ""}
                {summary.kpis.monthDeltaPercent}% vs last month
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Completion Rate</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{summary.kpis.completionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">{summary.kpis.completedAppointmentsThisMonth} completed</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <DistributionCard title="Cases by Type" rows={summary.casesByType} />
            <DistributionCard title="Cases by Status" rows={summary.casesByStatus} />
            <DistributionCard title="Appointments by Type" rows={summary.appointmentsByType} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Recently Opened Cases</h3>
              <span className="text-xs text-gray-500">Updated {new Date(summary.generatedAt).toLocaleString()}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Case #</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Client</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentCases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-400">No recent case activity.</td>
                    </tr>
                  ) : (
                    summary.recentCases.map((item) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/70">
                        <td className="px-3 py-2 font-mono text-xs text-blue-700">{item.caseNumber}</td>
                        <td className="px-3 py-2 text-gray-800">{item.clientName}</td>
                        <td className="px-3 py-2 text-gray-600">{humanize(item.caseType)}</td>
                        <td className="px-3 py-2 text-gray-600">{humanize(item.caseStatus)}</td>
                        <td className="px-3 py-2 text-gray-500">{new Date(item.openedAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
