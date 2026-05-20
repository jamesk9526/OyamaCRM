/**
 * RevenueProgress — circular progress card showing YTD raised vs goal.
 * Optionally includes awarded grants in the revenue total when `includeGrants` is true.
 * Shows a compact "Include Grants" toggle inside the card header.
 * Shows a skeleton loader while data is loading.
 */
"use client";

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

/** Exact USD formatter for dashboard amounts (no compact K/M shorthand). */
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function RevenueProgress({
  current,
  goal,
  grantAmount = 0,
  includeGrants = false,
  onToggleGrants,
  loading,
}: RevenueProgressProps) {
  // Total displayed is donations + grants when the toggle is on.
  const displayedTotal = current + (includeGrants ? grantAmount : 0);
  const rawPercentage = goal > 0 ? Math.round((displayedTotal / goal) * 100) : 0;
  const percentage = Math.max(0, Math.min(100, rawPercentage));
  const overGoalAmount = goal > 0 ? Math.max(displayedTotal - goal, 0) : 0;
  const breakdown = includeGrants && grantAmount > 0
    ? `${fmtCurrency(current)} donations + ${fmtCurrency(grantAmount)} grants`
    : `${fmtCurrency(current)} donations`;

  return (
    <div className="h-full">
      <div className="flex items-start justify-between mb-2.5">
        <h3 className="font-semibold text-slate-900">Revenue Progress</h3>

        {/* "Include Grants" toggle — only shown when grants data is available */}
        {onToggleGrants && (
          <button
            onClick={onToggleGrants}
            title={includeGrants ? "Showing donations + grants — click to show donations only" : "Click to include awarded grants in total"}
            className={`flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
              includeGrants
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700"
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

      <div className="flex flex-col items-center py-2.5">
        {loading ? (
          <div className="w-36 h-36 rounded-full bg-slate-100 animate-pulse" />
        ) : (
          <div className="relative group">
            <div className="rounded-full transition-transform hover:scale-[1.02]">
              <CircularProgress percentage={percentage} />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow">
                <div>{breakdown}</div>
                <div>Goal {fmtCurrency(goal)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 text-center">
          {loading ? (
            <div className="h-8 w-24 bg-slate-100 rounded animate-pulse mx-auto" />
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-900">
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
          <p className="text-sm text-slate-500 mt-1">
            {rawPercentage}% of {fmtCurrency(goal)} goal
          </p>
          {overGoalAmount > 0 && (
            <p className="text-[11px] text-green-700 font-semibold mt-1">
              +{fmtCurrency(overGoalAmount)} above goal
            </p>
          )}
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-50">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${percentage}%` }} />
        </div>

        <div className="mt-2 text-xs text-slate-500 text-center">
          {breakdown}
        </div>
      </div>
    </div>
  );
}
