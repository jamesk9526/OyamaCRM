/** Lapse Radar panel for live donor lapse-risk cohort visibility. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface LapseRadarResponse {
  cohorts: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  sample: Array<{
    constituentId: string;
    donorName: string;
    lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    recommendedAction: string;
  }>;
  updatedAt: string;
}

/**
 * StewardLapseRadarPanel displays risk cohorts and a short high-risk sample list
 * so staff can immediately triage donor reconnect work.
 */
export default function StewardLapseRadarPanel() {
  const [data, setData] = useState<LapseRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLapseRadar() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<LapseRadarResponse>("/api/steward-signals/lapse-radar");
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lapse radar.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLapseRadar();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Lapse Radar</h3>
        <p className="text-xs text-gray-500">{data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Loading..."}</p>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700">Low: {loading ? "--" : data?.cohorts.low ?? 0}</div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700">Medium: {loading ? "--" : data?.cohorts.medium ?? 0}</div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-700">High: {loading ? "--" : data?.cohorts.high ?? 0}</div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700">Critical: {loading ? "--" : data?.cohorts.critical ?? 0}</div>
      </div>

      <div className="mt-3 space-y-2">
        {(data?.sample ?? []).slice(0, 4).map((entry) => (
          <div key={entry.constituentId} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
            <p className="text-xs font-semibold text-gray-900">{entry.donorName} · {entry.lapseRisk}</p>
            <p className="text-xs text-gray-600 mt-0.5">{entry.reason}</p>
          </div>
        ))}
        {!loading && (data?.sample.length ?? 0) === 0 && (
          <p className="text-xs text-gray-500">No high-risk donors currently in sample.</p>
        )}
      </div>
    </article>
  );
}
