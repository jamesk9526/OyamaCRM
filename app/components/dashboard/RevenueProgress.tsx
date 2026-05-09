/**
 * RevenueProgress — circular progress card showing YTD raised vs goal.
 * Optionally includes awarded grants in the revenue total when `includeGrants` is true.
 * Shows a compact "Include Grants" toggle inside the card header.
 * Shows a skeleton loader while data is loading.
 */
"use client";

import Card from "@/app/components/ui/Card";
import CircularProgress from "@/app/components/ui/CircularProgress";

interface RevenueProgressProps {
  /** Donation-only YTD amount */
  current: number;
  /** Active campaign goal total */
  goal: number;
  /** YTD awarded grant amount — always passed, included only when includeGrants=true */
  grantAmount?: number;
  /** Whether to add grantAmount to current for display and progress calculation */
  includeGrants?: boolean;
  /** Called when the user toggles the "Include Grants" switch */
  onToggleGrants?: () => void;
  loading?: boolean;
}

/** Compact USD formatter: 12500 → "$12.5k", 1250000 → "$1.3M" */
function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

export default function RevenueProgress({
  current,
  goal,
  grantAmount = 0,
  includeGrants = false,
  onToggleGrants,
  loading,
}: RevenueProgressProps) {
  // Total displayed is donations + grants when the toggle is on
  const displayedTotal = current + (includeGrants ? grantAmount : 0);
  const percentage = goal > 0 ? Math.min(100, Math.round((displayedTotal / goal) * 100)) : 0;

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Revenue Progress</h3>

        {/* "Include Grants" toggle — only shown when grants data is available */}
        {onToggleGrants && (
          <button
            onClick={onToggleGrants}
            title={includeGrants ? "Showing donations + grants — click to show donations only" : "Click to include awarded grants in total"}
            className={`flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
              includeGrants
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
          >
            {/* Toggle pill icon */}
            <span className={`w-6 h-3 rounded-full relative transition-colors ${includeGrants ? "bg-emerald-400" : "bg-gray-300"}`}>
              <span
                className={`absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all ${
                  includeGrants ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
            Incl. Grants
          </button>
        )}
      </div>

      <div className="flex flex-col items-center py-4">
        {loading ? (
          <div className="w-36 h-36 rounded-full bg-gray-200 animate-pulse" />
        ) : (
          <CircularProgress percentage={percentage} />
        )}

        <div className="mt-4 text-center">
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mx-auto" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {fmtCurrency(displayedTotal)}
              </p>
              {/* Grant breakdown line — visible only when grants are included */}
              {includeGrants && grantAmount > 0 && (
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                  incl. {fmtCurrency(grantAmount)} in grants
                </p>
              )}
            </>
          )}
          <p className="text-sm text-gray-500 mt-1">
            of {fmtCurrency(goal)} goal
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="px-3 py-1 text-xs font-medium border border-gray-300 rounded hover:bg-gray-50">
            Revenue
          </button>
          <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded">
            Raised
          </button>
        </div>
      </div>
    </Card>
  );
}
