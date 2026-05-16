/** Lapse Radar panel for live donor lapse-risk cohort visibility. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardLapseRadarResponse } from "@/app/components/steward/steward-signals-types";

/**
 * StewardLapseRadarPanel displays risk cohorts and a short high-risk sample list
 * so staff can immediately triage donor reconnect work.
 */
export default function StewardLapseRadarPanel() {
  const [data, setData] = useState<StewardLapseRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLapseRadar() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<StewardLapseRadarResponse>("/api/steward-signals/lapse-radar");
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lapse radar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<StewardLapseRadarResponse>("/api/steward-signals/lapse-radar");
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lapse radar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const handleRebuild = () => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await apiFetch<StewardLapseRadarResponse>("/api/steward-signals/lapse-radar");
          if (!cancelled) setData(response);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lapse radar.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    };

    window.addEventListener("steward-signals:analysis-rebuilt", handleRebuild);

    return () => {
      cancelled = true;
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    };
  }, []);

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Lapse Radar 2.0</h3>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500">{data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Loading..."}</p>
          <button
            type="button"
            onClick={() => void loadLapseRadar()}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700">Low: {loading ? "--" : data?.cohorts.low ?? 0}</div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700">Medium: {loading ? "--" : data?.cohorts.medium ?? 0}</div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-700">High: {loading ? "--" : data?.cohorts.high ?? 0}</div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">Critical: {loading ? "--" : data?.cohorts.critical ?? 0}</div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Risk Distribution</p>
        <div className="mt-2 space-y-2">
          {(data?.distribution ?? []).map((entry) => (
            <div key={entry.label}>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{entry.label}</span>
                <span>{entry.value} ({entry.percentage}%)</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${entry.label === "Critical" ? "bg-red-500" : entry.label === "High" ? "bg-orange-500" : entry.label === "Medium" ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.max(4, entry.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
        <GroupCard label="Recently Became At-Risk" value={data?.groups.newlyMovedIntoRisk ?? 0} actionLabel="Review Cohort" />
        <GroupCard label="Recoverable Lapsed Donors" value={data?.groups.recoverableLapsedDonors ?? 0} actionLabel="Create Recovery Segment" />
        <GroupCard label="High-Value Lapsed Donors" value={data?.groups.highValueLapsedDonors ?? 0} actionLabel="Assign Personal Outreach" />
        <GroupCard label="Needs Personal Contact" value={data?.groups.needsPersonalContact ?? 0} actionLabel="Create Task Batch" />
        <GroupCard label="Safe For General Campaign" value={data?.groups.safeForGeneralCampaign ?? 0} actionLabel="Add To Campaign Audience" fullWidth />
      </section>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">High-priority donor sample</p>
        {(data?.sample ?? []).slice(0, 4).map((entry) => (
          <div key={entry.constituentId} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <p className="text-xs font-semibold text-gray-900">{entry.donorName} · {entry.lapseRisk}</p>
            <p className="text-xs text-gray-600 mt-0.5">{entry.reason}</p>
            <p className="text-xs text-gray-500 mt-0.5">{entry.recommendedAction}</p>
          </div>
        ))}
        {!loading && (data?.sample.length ?? 0) === 0 && (
          <p className="text-xs text-gray-500">No high-risk donors currently in sample.</p>
        )}
      </div>
    </article>
  );
}

interface GroupCardProps {
  label: string;
  value: number;
  actionLabel: string;
  fullWidth?: boolean;
}

/** GroupCard presents one lapse-risk action cohort with a review-first call to action. */
function GroupCard({ label, value, actionLabel, fullWidth = false }: GroupCardProps) {
  return (
    <article className={`rounded-lg border border-gray-200 bg-white p-3 ${fullWidth ? "md:col-span-2" : ""}`}>
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      <p className="mt-2 text-[11px] text-gray-500">Next action: {actionLabel}</p>
    </article>
  );
}
