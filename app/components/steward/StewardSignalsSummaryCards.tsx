/** Summary metric cards for Steward Signals live dashboard. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardSignalsSummaryResponse {
  highOpportunityDonors: number;
  atRiskCadenceBroken: number;
  monthlyGivingCandidates: number;
  thankYousNeeded: number;
  updatedAt: string;
}

interface StewardMetricCard {
  label: string;
  value: string;
  helper: string;
}

/**
 * StewardSignalsSummaryCards renders API-backed stewardship metrics for the
 * Steward Signals dashboard and clearly surfaces stale/error states.
 */
export default function StewardSignalsSummaryCards() {
  const [summary, setSummary] = useState<StewardSignalsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<StewardSignalsSummaryResponse>("/api/steward-signals/summary");
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();

    const handleRebuild = () => {
      void loadSummary();
    };

    window.addEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    const intervalId = window.setInterval(() => {
      void loadSummary();
    }, 36500);

    return () => {
      cancelled = true;
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
      window.clearInterval(intervalId);
    };
  }, []);

  const metrics: StewardMetricCard[] = useMemo(() => {
    return [
      {
        label: "High Opportunity Donors",
        value: loading ? "--" : `${summary?.highOpportunityDonors ?? 0}`,
        helper: "Donors scoring high for timely stewardship action.",
      },
      {
        label: "At-Risk / Cadence Broken",
        value: loading ? "--" : `${summary?.atRiskCadenceBroken ?? 0}`,
        helper: "Donors likely to lapse based on recency and status signals.",
      },
      {
        label: "Monthly Giving Candidates",
        value: loading ? "--" : `${summary?.monthlyGivingCandidates ?? 0}`,
        helper: "Consistent donors with no active recurring commitment.",
      },
      {
        label: "Thank-Yous Needed",
        value: loading ? "--" : `${summary?.thankYousNeeded ?? 0}`,
        helper: "Open thank-you tasks waiting on staff completion.",
      },
    ];
  }, [loading, summary]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {summary?.updatedAt ? `Updated ${new Date(summary.updatedAt).toLocaleString()}` : "Loading live summary..."}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{metric.label}</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-green-50 text-green-700 border-green-200"
            >
              Live
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{metric.value}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{metric.helper}</p>
        </div>
      ))}
      </div>
    </section>
  );
}
