/**
 * Reports page.
 * Analytics and reporting with real API data: summary stats, monthly giving chart,
 * top donors table, and donor retention card.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Summary stats shape from GET /api/reports/summary */
interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  weekAmount: number;
  activeCampaigns: number;
  pendingTasks: number;
}

/** Monthly giving data point */
interface MonthlyDatum {
  month: number;
  amount: number;
}

/** Donor retention data */
interface Retention {
  total: number;
  retained: number;
  rate: number;
}

/** Top donor row */
interface TopDonor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  totalLifetimeGiving: number | string;
  lastGiftDate?: string;
  donorStatus: string;
}

/** Tailwind classes for donor status badge */
function statusColor(s: string) {
  switch (s) {
    case "ACTIVE": return "bg-green-50 text-green-700";
    case "MAJOR_DONOR": return "bg-amber-50 text-amber-700";
    case "LAPSED": return "bg-red-50 text-red-600";
    case "NEW": return "bg-blue-50 text-blue-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

/** Skeleton block for loading state */
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/** Reports page component */
export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDatum[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, m, r, d] = await Promise.all([
          apiFetch<Summary>("/api/reports/summary"),
          apiFetch<MonthlyDatum[]>(`/api/reports/giving-by-month?year=${year}`),
          apiFetch<Retention>("/api/reports/donor-retention"),
          apiFetch<TopDonor[]>("/api/reports/top-donors?limit=10"),
        ]);
        setSummary(s);
        setMonthly(Array.isArray(m) ? m : []);
        setRetention(r);
        setTopDonors(Array.isArray(d) ? d : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year]);

  const maxAmount = monthly.length > 0 ? Math.max(...monthly.map((m) => m.amount), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Giving trends, retention, and fundraising analytics</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Could not connect to API — start it with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Constituents", value: summary?.totalConstituents, prefix: "" },
          { label: "YTD Revenue", value: summary?.ytdAmount, prefix: "$", format: "currency" },
          { label: "Retention Rate", value: retention?.rate, suffix: "%" },
          { label: "Active Campaigns", value: summary?.activeCampaigns },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            {loading ? (
              <Sk className="h-8 w-20 mt-2" />
            ) : (
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {s.prefix}{s.format === "currency" && s.value != null
                  ? Number(s.value).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  : (s.value ?? "—")}{s.suffix ?? ""}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly giving chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Monthly Giving — {year}</h2>
          {loading ? (
            <div className="flex items-end gap-2 h-40">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 bg-gray-200 animate-pulse rounded-t" style={{ height: `${Math.random() * 80 + 20}%` }} />
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {monthly.map((d) => {
                const h = maxAmount > 0 ? Math.max(4, (d.amount / maxAmount) * 100) : 4;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-default relative"
                      style={{ height: `${h}%` }}
                      title={`$${d.amount.toLocaleString()}`}
                    />
                    <span className="text-[10px] text-gray-400">{MONTHS[d.month - 1]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Retention card */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Donor Retention</h2>
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Sk className="h-16 w-24" />
              <Sk className="h-4 w-32" />
            </div>
          ) : retention ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-5xl font-bold text-green-600">{retention.rate}%</p>
              <p className="text-sm text-gray-500">Retention Rate</p>
              <p className="text-xs text-gray-400 mt-2">
                {retention.retained} of {retention.total} donors gave again this year
              </p>
              {/* Mini ring */}
              <div className="mt-3 relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.915" fill="none"
                    stroke="#16a34a" strokeWidth="3"
                    strokeDasharray={`${retention.rate} ${100 - retention.rate}`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center mt-4">No retention data</p>
          )}
        </div>
      </div>

      {/* Top donors table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Top Donors by Lifetime Giving</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Rank", "Name", "Email", "Lifetime Giving", "Last Gift", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><Sk className="h-4 w-24" /></td>
                    ))}</tr>
                  ))
                : topDonors.map((d, i) => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-400">#{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.firstName} {d.lastName}</td>
                      <td className="px-4 py-3 text-gray-500">{d.email ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        ${Number(d.totalLifetimeGiving).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {d.lastGiftDate ? new Date(d.lastGiftDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(d.donorStatus)}`}>
                          {d.donorStatus === "MAJOR_DONOR" ? "Major Donor" : d.donorStatus.charAt(0) + d.donorStatus.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && topDonors.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No donor data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
