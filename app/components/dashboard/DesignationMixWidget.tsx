"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import type { ReportingYearMode } from "@/app/lib/fiscal-year";

type DesignationSummary = { slices: Array<{ name: string; amount: number }>; total: number };

export default function DesignationMixWidget({ dateBasis }: { dateBasis: ReportingYearMode }) {
  const [report, setReport] = useState<DesignationSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setLoading(true);
    apiFetch<DesignationSummary>(`/api/reports/designations-summary?dateBasis=${dateBasis}`)
      .then((data) => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dateBasis]);

  if (loading) return <div className="h-32 animate-pulse rounded-lg bg-gray-50" />;
  if (!report) return <p className="flex h-32 items-center justify-center text-sm text-gray-400">Fund data could not be loaded.</p>;
  if (error || report.slices.length === 0) {
    return <p className="flex h-32 items-center justify-center text-sm text-gray-400">{error ? "Fund data could not be loaded." : "No designated gifts in this period."}</p>;
  }

  const topSlices = report.slices.slice(0, 5);
  return (
    <div className="space-y-3">
      {topSlices.map((slice) => {
        const share = report.total > 0 ? (slice.amount / report.total) * 100 : 0;
        return <div key={slice.name}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-medium text-gray-700">{slice.name}</span>
            <span className="shrink-0 text-gray-500">${slice.amount.toLocaleString()} · {Math.round(share)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(share, 2)}%` }} /></div>
        </div>;
      })}
      <Link href="/reports" className="inline-flex pt-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open giving reports →</Link>
    </div>
  );
}
