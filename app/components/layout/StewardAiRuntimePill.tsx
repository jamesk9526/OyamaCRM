/** Steward AI status pill + popover for live runtime visibility in the global TopBar. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type StewardAiRuntimeStatus =
  | "disabled"
  | "not_configured"
  | "connecting"
  | "connected"
  | "thinking"
  | "running_task"
  | "error"
  | "fallback";

interface StewardAiRuntimeState {
  enabled: boolean;
  status: StewardAiRuntimeStatus;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
  thinkingModel: string;
  activeTaskCount: number;
  currentTaskLabel: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}

interface StewardAiRuntimePillProps {
  canRunConnectionTest: boolean;
  onOpenSettings: () => void;
  initialState?: StewardAiRuntimeState | null;
  compact?: boolean;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Never";
  return new Date(parsed).toLocaleString();
}

export function statusCopy(status: StewardAiRuntimeStatus): {
  label: string;
  pillTone: string;
  dotTone: string;
  dotPulse: boolean;
  spinner: boolean;
  helper: string;
} {
  if (status === "connected") {
    return {
      label: "Steward: Connected",
      pillTone: "border-emerald-300/60 bg-emerald-500/20 text-emerald-50",
      dotTone: "bg-emerald-300",
      dotPulse: false,
      spinner: false,
      helper: "Local AI connected and idle.",
    };
  }

  if (status === "thinking") {
    return {
      label: "Steward: Thinking",
      pillTone: "border-blue-300/70 bg-blue-500/20 text-blue-50",
      dotTone: "bg-blue-300",
      dotPulse: true,
      spinner: false,
      helper: "Steward is analyzing donor opportunities.",
    };
  }

  if (status === "running_task") {
    return {
      label: "Steward: Running Task",
      pillTone: "border-cyan-300/70 bg-cyan-500/20 text-cyan-50",
      dotTone: "bg-cyan-300",
      dotPulse: false,
      spinner: true,
      helper: "Generating donor engagement recommendations.",
    };
  }

  if (status === "connecting") {
    return {
      label: "Steward: Connecting",
      pillTone: "border-indigo-300/70 bg-indigo-500/20 text-indigo-50",
      dotTone: "bg-indigo-300",
      dotPulse: true,
      spinner: false,
      helper: "Checking runtime connectivity.",
    };
  }

  if (status === "fallback") {
    return {
      label: "Steward: Offline",
      pillTone: "border-amber-300/70 bg-amber-500/20 text-amber-50",
      dotTone: "bg-amber-300",
      dotPulse: false,
      spinner: false,
      helper: "AI unavailable. Deterministic Steward rules remain active.",
    };
  }

  if (status === "error") {
    return {
      label: "Steward: Error",
      pillTone: "border-rose-300/70 bg-rose-500/20 text-rose-50",
      dotTone: "bg-rose-300",
      dotPulse: false,
      spinner: false,
      helper: "Last AI task failed. Check runtime details.",
    };
  }

  if (status === "not_configured") {
    return {
      label: "Steward: Not Configured",
      pillTone: "border-slate-300/60 bg-slate-500/20 text-slate-100",
      dotTone: "bg-slate-300",
      dotPulse: false,
      spinner: false,
      helper: "AI is enabled but runtime settings are incomplete.",
    };
  }

  return {
    label: "Steward: Disabled",
    pillTone: "border-slate-300/60 bg-slate-500/20 text-slate-100",
    dotTone: "bg-slate-300",
    dotPulse: false,
    spinner: false,
    helper: "Steward AI is currently disabled.",
  };
}

/**
 * Shows a compact runtime-status badge and gives staff one-click runtime diagnostics.
 */
export default function StewardAiRuntimePill({ canRunConnectionTest, onOpenSettings, initialState = null, compact = false }: StewardAiRuntimePillProps) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<StewardAiRuntimeState | null>(initialState);

  const loadStatus = useCallback(async (force = false) => {
    try {
      const data = await apiFetch<StewardAiRuntimeState>(`/api/steward-ai/status${force ? "?force=1" : ""}`);
      setState(data);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Steward status.");
    }
  }, []);

  useEffect(() => {
    void loadStatus(false);

    const intervalId = window.setInterval(() => {
      void loadStatus(false);
    }, 45000);

    return () => window.clearInterval(intervalId);
  }, [loadStatus]);

  useEffect(() => {
    if (!open) return;
    void loadStatus(true);
  }, [open, loadStatus]);

  const tone = useMemo(() => statusCopy(state?.status ?? "disabled"), [state?.status]);
  const compactLabel = useMemo(() => {
    const status = state?.status ?? "disabled";
    if (status === "connected") return "Connected";
    if (status === "thinking") return "Thinking";
    if (status === "running_task") return "Running";
    if (status === "connecting") return "Connecting";
    if (status === "fallback") return "Offline";
    if (status === "error") return "Error";
    if (status === "not_configured") return "Setup";
    return "Disabled";
  }, [state?.status]);

  const tooltip = `${tone.helper} ${state ? `${state.mode === "local" ? "Local" : "Remote"} mode · ${state.model}.` : ""}`.trim();

  async function runConnectionTest() {
    if (!canRunConnectionTest || testing) return;

    setTesting(true);
    setError(null);

    try {
      await apiFetch("/api/steward-ai/test", { method: "POST", body: JSON.stringify({}) });
      await loadStatus(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Connection test failed.");
      await loadStatus(true);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        title={tooltip}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center rounded-full border font-semibold transition-colors ${tone.pillTone} ${compact ? "h-8 gap-1.5 px-2.5 text-[11px]" : "h-9 gap-2 px-3 text-xs"}`}
      >
        {tone.spinner ? (
          <span className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} animate-spin rounded-full border-2 border-current border-r-transparent`} aria-hidden="true" />
        ) : (
          <span className={`${compact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full ${tone.dotTone} ${tone.dotPulse ? "animate-pulse" : ""}`} aria-hidden="true" />
        )}
        {compact ? (
          <>
            <span className="hidden min-[1320px]:inline">Steward</span>
            <span>{compactLabel}</span>
          </>
        ) : (
          <>
            <span className="hidden min-[1280px]:inline">{tone.label}</span>
            <span className="min-[1280px]:hidden">AI</span>
          </>
        )}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Steward AI Runtime</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{tone.label}</p>
              <p className="mt-1 text-xs text-slate-500">{tone.helper}</p>
            </div>

            <div className="space-y-2 px-4 py-3 text-xs text-slate-700">
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Provider</span>
                <span className="font-medium">{state?.mode === "remote" ? "Remote" : "Local"}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Endpoint</span>
                <span className="truncate font-medium" title={state?.endpointUrl || ""}>{state?.endpointUrl || "Not set"}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Model</span>
                <span className="font-medium">{state?.model || "Not set"}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Thinking model</span>
                <span className="font-medium">{state?.thinkingModel || "Not set"}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Active task count</span>
                <span className="font-medium">{state?.activeTaskCount ?? 0}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Current task</span>
                <span className="font-medium">{state?.currentTaskLabel || "None"}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Last success</span>
                <span className="font-medium">{formatTimestamp(state?.lastSuccessAt ?? null)}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Last checked</span>
                <span className="font-medium">{formatTimestamp(state?.lastCheckedAt ?? null)}</span>
              </div>
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <span className="text-slate-500">Last error</span>
                <span className="font-medium">{state?.lastErrorMessage || "None"}</span>
              </div>
            </div>

            {(error || state?.lastErrorMessage) ? (
              <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">
                {error || state?.lastErrorMessage}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => void runConnectionTest()}
                disabled={!canRunConnectionTest || testing}
                className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "Testing..." : "Test AI Connection"}
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open AI Settings
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
