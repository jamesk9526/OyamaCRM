"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface AiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
}

interface RuntimeState {
  status: string;
  mode: "local" | "remote" | "unknown";
  model: string;
  currentTaskLabel?: string | null;
  fallbackReason?: string | null;
}

interface AiInsightsWidgetProps {
  dashboardEnabled: boolean;
  onToggleDashboardEnabled: (next: boolean) => void;
}

/** AiInsightsWidget shows runtime state and controls whether AI dashboard widgets are enabled. */
export default function AiInsightsWidget({ dashboardEnabled, onToggleDashboardEnabled }: AiInsightsWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AiConfigPayload | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);

  async function loadAiStatus() {
    setLoading(true);
    setError(null);
    try {
      const [nextConfig, nextRuntime] = await Promise.all([
        apiFetch<AiConfigPayload>("/api/steward-ai/config"),
        apiFetch<RuntimeState>("/api/steward-ai/status"),
      ]);
      setConfig(nextConfig);
      setRuntime(nextRuntime);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load AI runtime status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAiStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">AI status unavailable</p>
          <p className="text-xs text-amber-700 mt-1">{error}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Runtime</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{runtime?.status ?? "Unknown"}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Mode: {runtime?.mode ?? config?.mode ?? "unknown"} · Model: {runtime?.model ?? config?.model ?? "not set"}
          </p>
          {runtime?.currentTaskLabel ? (
            <p className="text-xs text-gray-500 mt-1">Active: {runtime.currentTaskLabel}</p>
          ) : null}
          {runtime?.fallbackReason ? (
            <p className="text-xs text-amber-700 mt-1">Fallback: {runtime.fallbackReason}</p>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI widgets on dashboard</p>
        <p className="text-xs text-gray-600 mt-1">
          Toggle AI-specific widgets without changing global AI settings.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleDashboardEnabled(!dashboardEnabled)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border ${dashboardEnabled ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-100 border-gray-200 text-gray-700"}`}
          >
            {dashboardEnabled ? "Enabled" : "Disabled"}
          </button>
          <button
            type="button"
            onClick={() => void loadAiStatus()}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Refresh status
          </button>
        </div>
      </div>

      {!config?.enabled ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">
            Steward AI is disabled in organization settings.
          </p>
          <Link href="/settings/ai" className="inline-flex mt-1 text-xs font-semibold text-amber-800 hover:underline">
            Open AI settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
