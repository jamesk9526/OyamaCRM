/**
 * BoardDashboard — simplified reporting dashboard for board member (report_viewer) accounts.
 * Displays key fundraising KPIs, giving trends, and a donor retention summary.
 * All data is fetched from the reports API and presented in read-only card widgets.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface KpiSummary {
  ytdRevenue: number;
  ytdGoal: number;
  donorRetentionRate: number;
  totalDonors: number;
  newDonorsYtd: number;
  totalGiftsYtd: number;
  averageGift: number;
  majorGiftCount: number;
}

interface TrendPoint {
  label: string;
  amount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a dollar amount into a short human-readable string (e.g. $1.2M, $45K). */
function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

/** Calculates the percentage-of-goal for the circular progress ring. */
function calcProgress(revenue: number, goal: number): number {
  if (!goal) return 0;
  return Math.min(100, Math.round((revenue / goal) * 100));
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Circular progress ring showing YTD revenue vs. goal.
 * Uses SVG stroke-dasharray trick for smooth arc animation.
 */
function RevenueRing({ pct }: { pct: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width={140} height={140} className="block">
      {/* Background ring */}
      <circle cx={70} cy={70} r={r} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      {/* Progress arc — starts at top (−90°) */}
      <circle
        cx={70}
        cy={70}
        r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth={12}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
      />
      {/* Centre label */}
      <text x={70} y={66} textAnchor="middle" className="text-lg font-bold fill-gray-900" fontSize={22} fontWeight={700}>
        {pct}%
      </text>
      <text x={70} y={84} textAnchor="middle" className="fill-gray-500" fontSize={11} fill="#6b7280">
        of goal
      </text>
    </svg>
  );
}

/** Single KPI card with a label, primary value, and optional sub-value. */
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

/** Bar chart rendered with inline divs — no chart library needed. */
function SimpleBarChart({ data, max }: { data: TrendPoint[]; max: number }) {
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((pt) => {
        const pct = max > 0 ? (pt.amount / max) * 100 : 0;
        return (
          <div key={pt.label} className="flex flex-col items-center flex-1 gap-1">
            <div className="w-full bg-green-100 rounded-t relative" style={{ height: `${Math.max(pct, 4)}%` }}>
              <div
                className="absolute bottom-0 w-full bg-green-600 rounded-t transition-all"
                style={{ height: "100%" }}
              />
            </div>
            <span className="text-[10px] text-gray-400 truncate w-full text-center">{pt.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

/**
 * BoardDashboard fetches KPI summary + monthly trend from the reports API
 * and renders them in a 3-column grid of metric cards and charts.
 */
export default function BoardDashboard() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch reports summary from the API
    setLoading(true);
    apiFetch<{ summary: KpiSummary; monthlyTrend: TrendPoint[] }>("/api/reports/board-summary")
      .then((data) => {
        setKpi(data.summary);
        setTrend(data.monthlyTrend ?? []);
      })
      .catch((err: unknown) => {
        // Fall back to empty/zeroed state if the endpoint isn't ready yet
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        setKpi({
          ytdRevenue: 0,
          ytdGoal: 0,
          donorRetentionRate: 0,
          totalDonors: 0,
          newDonorsYtd: 0,
          totalGiftsYtd: 0,
          averageGift: 0,
          majorGiftCount: 0,
        });
        setTrend([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const pct = kpi ? calcProgress(kpi.ytdRevenue, kpi.ytdGoal) : 0;
  const trendMax = trend.length ? Math.max(...trend.map((t) => t.amount), 1) : 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Board Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {currentYear} fundraising overview — read-only board reporting view
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error} — showing zeroed data until the reports API is connected.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── Row 1: Revenue ring + KPIs ─────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* YTD Revenue ring */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center gap-3 md:col-span-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide self-start">YTD Revenue</p>
              <RevenueRing pct={pct} />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{kpi ? formatCurrency(kpi.ytdRevenue) : "—"}</p>
                <p className="text-xs text-gray-400">
                  of {kpi ? formatCurrency(kpi.ytdGoal) : "—"} goal
                </p>
              </div>
            </div>

            {/* KPI grid */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Donor Retention"
                value={kpi ? `${kpi.donorRetentionRate}%` : "—"}
                sub="year-over-year"
              />
              <KpiCard label="Total Donors" value={kpi ? kpi.totalDonors.toLocaleString() : "—"} />
              <KpiCard
                label="New Donors YTD"
                value={kpi ? kpi.newDonorsYtd.toLocaleString() : "—"}
              />
              <KpiCard
                label="Total Gifts YTD"
                value={kpi ? kpi.totalGiftsYtd.toLocaleString() : "—"}
              />
              <KpiCard
                label="Average Gift"
                value={kpi ? formatCurrency(kpi.averageGift) : "—"}
              />
              <KpiCard
                label="Major Gifts"
                value={kpi ? kpi.majorGiftCount.toLocaleString() : "—"}
                sub="$1,000+ gifts"
              />
            </div>
          </div>

          {/* ─── Row 2: Monthly giving trend ────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Monthly Giving Trend — {currentYear}</p>
            {trend.length > 0 ? (
              <SimpleBarChart data={trend} max={trendMax} />
            ) : (
              <div className="h-28 flex items-center justify-center text-sm text-gray-400">
                No trend data available yet.
              </div>
            )}
          </div>

          {/* ─── Row 3: Donor status breakdown ──────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Donor Status Overview</p>
            <div className="flex gap-6 flex-wrap">
              {[
                { label: "Active Donors", pct: 68, color: "bg-green-500" },
                { label: "Lapsed (12+ mo)", pct: 22, color: "bg-amber-400" },
                { label: "New This Year", pct: 10, color: "bg-blue-500" },
              ].map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                  <span className="text-sm text-gray-700">
                    {seg.label} — <span className="font-medium">{seg.pct}%</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Percentages are illustrative until the reports API is fully wired.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
