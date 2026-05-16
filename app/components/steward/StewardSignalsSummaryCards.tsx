/** Summary metric cards for Steward Signals live dashboard. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardSummaryResponse } from "@/app/components/steward/steward-signals-types";

interface StewardMetricCard {
  key: string;
  label: string;
  value: string;
  helper: string;
  toneClass: string;
}

interface StewardSignalsSummaryCardsProps {
  onSummaryLoaded?: (summary: StewardSummaryResponse) => void;
}

/**
 * StewardSignalsSummaryCards renders API-backed stewardship metrics for the
 * Steward Signals dashboard and clearly surfaces stale/error states.
 */
export default function StewardSignalsSummaryCards({ onSummaryLoaded }: StewardSignalsSummaryCardsProps) {
  const [summary, setSummary] = useState<StewardSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiFetch<StewardSummaryResponse>("/api/steward-signals/summary");
        if (!cancelled) {
          setSummary(data);
          onSummaryLoaded?.(data);
        }
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

    return () => {
      cancelled = true;
      window.removeEventListener("steward-signals:analysis-rebuilt", handleRebuild);
    };
  }, [onSummaryLoaded]);

  const metrics: StewardMetricCard[] = useMemo(() => {
    return [
      {
        key: "donor-health",
        label: "Donor Health Score",
        value: loading ? "--" : `${summary?.donorHealthScore ?? 0}`,
        helper: "Blended RFM + engagement + lapse trend index.",
        toneClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      {
        key: "high-opportunity",
        label: "High Opportunity Donors",
        value: loading ? "--" : `${summary?.highOpportunityDonors ?? 0}`,
        helper: "Donors scoring high for timely stewardship action.",
        toneClass: "bg-green-50 text-green-700 border-green-200",
      },
      {
        key: "at-risk",
        label: "At-Risk / Cadence Broken",
        value: loading ? "--" : `${summary?.atRiskCadenceBroken ?? 0}`,
        helper: "Donors likely to lapse based on recency and status signals.",
        toneClass: "bg-amber-50 text-amber-700 border-amber-200",
      },
      {
        key: "critical-lapse",
        label: "Critical Lapse Risk",
        value: loading ? "--" : `${summary?.criticalLapseRisk ?? 0}`,
        helper: "Highest-risk donors requiring personal follow-up now.",
        toneClass: "bg-red-50 text-red-700 border-red-200",
      },
      {
        key: "thank-yous",
        label: "Thank-Yous Needed",
        value: loading ? "--" : `${summary?.thankYousNeeded ?? 0}`,
        helper: "Open thank-you tasks waiting on completion.",
        toneClass: "bg-sky-50 text-sky-700 border-sky-200",
      },
      {
        key: "monthly-candidates",
        label: "Monthly Giving Candidates",
        value: loading ? "--" : `${summary?.monthlyGivingCandidates ?? 0}`,
        helper: "Consistent donors with no active recurring commitment.",
        toneClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      },
      {
        key: "first-time-follow-up",
        label: "First-Time Follow-Up",
        value: loading ? "--" : `${summary?.firstTimeDonorFollowUpNeeded ?? 0}`,
        helper: "New donors that should receive early relationship follow-up.",
        toneClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
      },
      {
        key: "major-movement",
        label: "Major Donor Movement",
        value: loading ? "--" : `${summary?.majorDonorMovement ?? 0}`,
        helper: "Major donor records showing meaningful stewardship signals.",
        toneClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
      },
      {
        key: "lapsed-donors",
        label: "Lapsed Donors",
        value: loading ? "--" : `${summary?.lapsedDonors ?? 0}`,
        helper: "Constituents currently marked as lapsed donors.",
        toneClass: "bg-rose-50 text-rose-700 border-rose-200",
      },
      {
        key: "open-actions",
        label: "Open Stewardship Actions",
        value: loading ? "--" : `${summary?.openStewardshipActions ?? 0}`,
        helper: "Pending follow-up, email, and thank-you work queue.",
        toneClass: "bg-slate-100 text-slate-700 border-slate-200",
      },
    ];
  }, [loading, summary]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {summary?.updatedAt ? `Updated ${new Date(summary.updatedAt).toLocaleString()}` : "Loading live summary..."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setLoading(true);
                try {
                  const data = await apiFetch<StewardSummaryResponse>("/api/steward-signals/summary");
                  setSummary(data);
                  onSummaryLoaded?.(data);
                } catch (requestError) {
                  setError(requestError instanceof Error ? requestError.message : "Failed to load summary.");
                } finally {
                  setLoading(false);
                }
              })();
            }}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
      {metrics.map((metric) => (
        <div key={metric.key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{metric.label}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${metric.toneClass}`}
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
