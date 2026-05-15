"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface OpportunityRow {
  id: string;
  donorName?: string;
  constituentName?: string;
  suggestedAction?: string;
  reason?: string;
  opportunityScore?: number;
  confidence?: number;
}

interface AiOpportunityWidgetProps {
  dashboardEnabled: boolean;
  onEnableDashboardAi: () => void;
}

/** AiOpportunityWidget shows top stewardship opportunities when dashboard AI widgets are enabled. */
export default function AiOpportunityWidget({ dashboardEnabled, onEnableDashboardAi }: AiOpportunityWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<OpportunityRow[]>([]);

  useEffect(() => {
    if (!dashboardEnabled) return;

    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<OpportunityRow[]>("/api/steward-signals/opportunities?limit=4");
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load AI opportunities.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [dashboardEnabled]);

  if (!dashboardEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
        <p className="text-xs font-semibold text-gray-700">AI opportunity widget is disabled.</p>
        <p className="text-xs text-gray-600 mt-1">Enable AI widgets to view top stewardship opportunities on the dashboard.</p>
        <button
          type="button"
          onClick={onEnableDashboardAi}
          className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-green-200 bg-green-50 text-green-700"
        >
          Enable AI widgets
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">AI opportunities unavailable</p>
        <p className="text-xs text-amber-700 mt-1">{error}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-xs text-gray-600">No opportunity signals are available right now.</p>
        <Link href="/steward-signals" className="inline-flex mt-1 text-xs font-semibold text-green-700 hover:underline">
          Open Steward Signals
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Link
          key={row.id}
          href="/steward-signals"
          className="block rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 hover:bg-indigo-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-indigo-900">
              {row.donorName || row.constituentName || "Donor signal"}
            </p>
            <p className="text-[11px] font-semibold text-indigo-700">
              Score {row.opportunityScore ?? row.confidence ?? 0}
            </p>
          </div>
          <p className="text-xs text-indigo-800 mt-1 line-clamp-2">{row.suggestedAction || "Review suggested next step."}</p>
        </Link>
      ))}
    </div>
  );
}
