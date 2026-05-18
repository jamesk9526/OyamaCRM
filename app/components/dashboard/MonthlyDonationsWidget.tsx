/**
 * MonthlyDonationsWidget — Dashboard card showing running donation total for the current month.
 * Displays total amount + donor count, with an expandable panel that lists each donor who gave.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

interface MonthDonor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  amount: number;
  lastDate: string;
  giftCount: number;
}

interface MonthlyData {
  total: number;
  count: number;
  giftCount: number;
  monthLabel: string;
  donors: MonthDonor[];
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MonthlyDonationsWidget() {
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDonors, setShowDonors] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<MonthlyData>("/api/reports/donors-this-month");
      setData(result);
    } catch {
      // Silently fail — show zero state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = data?.monthLabel ?? new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      {/* ── Running total row ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{monthLabel}</p>
          {loading ? (
            <div className="h-8 w-24 mt-1 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-0.5 tabular-nums">
              {formatUsd(data?.total ?? 0)}
            </p>
          )}
          {!loading && (
            <p className="text-xs text-gray-500 mt-1">
              {data?.giftCount ?? 0} gift{(data?.giftCount ?? 0) !== 1 ? "s" : ""} from{" "}
              <span className="font-medium text-gray-700">{data?.count ?? 0}</span> donor{(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {/* Green accent icon */}
        <span className="shrink-0 w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </div>

      {/* ── View donors toggle ── */}
      {!loading && (data?.count ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setShowDonors((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${showDonors ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          {showDonors ? "Hide donors" : `View ${data?.count} donor${(data?.count ?? 0) !== 1 ? "s" : ""} who gave this month`}
        </button>
      )}

      {/* ── Donor list panel ── */}
      {showDonors && data && data.donors.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {data.donors.map((donor) => (
              <div key={donor.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <Link
                    href={`/constituents/${donor.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-green-700 truncate block"
                  >
                    {donor.firstName} {donor.lastName}
                  </Link>
                  {donor.email && (
                    <p className="text-[11px] text-gray-400 truncate">{donor.email}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatUsd(donor.amount)}</p>
                  <p className="text-[11px] text-gray-400">
                    {donor.giftCount > 1 ? `${donor.giftCount} gifts · ` : ""}{formatDate(donor.lastDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {/* Footer link */}
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
            <Link
              href={`/donations?filter=this-month`}
              className="text-xs font-semibold text-green-700 hover:text-green-900 transition-colors"
            >
              View all donations this month →
            </Link>
          </div>
        </div>
      )}

      {!loading && (data?.count ?? 0) === 0 && (
        <p className="text-xs text-gray-400 italic">No donations recorded yet this month.</p>
      )}
    </div>
  );
}
