/** Donor profile Steward Signals widget shell with live API contract integration. */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { formatCurrency, formatDate } from "@/app/components/constituents/constituent-utils";

interface DonorStewardSignalsWidgetResponse {
  constituentId: string;
  donorName: string;
  generosityScore: number;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  bestNextStep: string;
  bestChannel: string;
  confidence: number;
  explanation: string;
  lastGiftDate: string | null;
  lastGiftAmount: number;
  totalLifetimeGiving: number;
  giftCount: number;
  inDevelopmentNote: string;
}

interface DonorStewardSignalsWidgetProps {
  constituentId: string;
}

/**
 * DonorStewardSignalsWidget renders a read-first stewardship snapshot on donor profiles.
 * The widget is intentionally non-destructive until full score recalculation + workflow APIs are finalized.
 */
export default function DonorStewardSignalsWidget({ constituentId }: DonorStewardSignalsWidgetProps) {
  const [data, setData] = useState<DonorStewardSignalsWidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWidget() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<DonorStewardSignalsWidgetResponse>(`/api/steward-signals/donors/${constituentId}/widget`);
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Steward Signals widget.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWidget();
    return () => {
      cancelled = true;
    };
  }, [constituentId]);

  const lapseRiskStyle =
    data?.lapseRisk === "CRITICAL"
      ? "bg-red-50 text-red-700 border-red-200"
      : data?.lapseRisk === "HIGH"
        ? "bg-orange-50 text-orange-700 border-orange-200"
        : data?.lapseRisk === "MEDIUM"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-green-50 text-green-700 border-green-200";

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Steward Signals</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700">Live Rules</span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Metric label="Generosity" value={loading ? "--" : `${data?.generosityScore ?? 0}/100`} />
        <Metric label="Opportunity" value={loading ? "--" : `${data?.opportunityScore ?? 0}/100`} />
        <Metric label="Confidence" value={loading ? "--" : `${data?.confidence ?? 0}%`} />
        <div className="rounded-lg border p-2">
          <p className="text-xs uppercase tracking-wide text-gray-500">Lapse Risk</p>
          <p className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${lapseRiskStyle}`}>
            {loading ? "--" : data?.lapseRisk ?? "LOW"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Best Next Step</p>
        <p className="text-sm text-gray-800">{loading ? "Loading recommendation..." : data?.bestNextStep ?? "No recommendation yet."}</p>
        <p className="text-xs text-gray-600">
          Channel: {loading ? "--" : data?.bestChannel ?? "--"}
          {data?.lastGiftDate ? ` · Last Gift ${formatDate(data.lastGiftDate)} (${formatCurrency(data.lastGiftAmount)})` : ""}
        </p>
      </div>

      <p className="text-xs text-gray-500">
        {loading
          ? "Loading signal explanation..."
          : data?.explanation ?? "Rules use live giving behavior, cadence, and stewardship context."}
      </p>

      <p className="text-[11px] text-gray-400">{data?.inDevelopmentNote ?? "Read-only shell until full action orchestration is enabled."}</p>
      <p className="text-[11px] text-gray-400">API: GET /api/steward-signals/donors/:id/widget</p>
    </section>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

/** Metric presents compact labeled values in the donor widget grid. */
function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
