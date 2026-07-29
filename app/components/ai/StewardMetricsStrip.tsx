"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface StewardRuntimeState {
  enabled: boolean;
  status: "disabled" | "not_configured" | "connecting" | "connected" | "thinking" | "running_task" | "error" | "fallback";
  mode: "local" | "remote";
  model: string;
  activeTaskCount: number;
  currentTaskLabel: string | null;
  lastSuccessAt: string | null;
}

function relativeTime(value: string | null): string {
  if (!value) return "No completed runs";
  const age = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(age)) return "Recently";
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const statusLabel: Record<StewardRuntimeState["status"], string> = {
  disabled: "Disabled",
  not_configured: "Needs setup",
  connecting: "Connecting",
  connected: "Ready",
  thinking: "Thinking",
  running_task: "Working",
  error: "Attention needed",
  fallback: "Fallback mode",
};

/** Compact, live Steward health and activity metrics shared by the companion surfaces. */
export default function StewardMetricsStrip() {
  const [state, setState] = useState<StewardRuntimeState | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await apiFetch<StewardRuntimeState>("/api/steward-ai/status"));
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const status = state?.status ?? "connecting";
  const isHealthy = status === "connected" || status === "thinking" || status === "running_task";
  const dot = isHealthy ? "bg-emerald-500" : status === "error" ? "bg-rose-500" : "bg-slate-400";

  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-[10px] sm:px-4">
      <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
        <p className="uppercase tracking-[0.12em] text-slate-400">Status</p>
        <p className="mt-0.5 flex items-center gap-1 truncate font-semibold text-slate-700">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot} ${isHealthy ? "animate-pulse" : ""}`} />
          {statusLabel[status]}
        </p>
      </div>
      <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
        <p className="uppercase tracking-[0.12em] text-slate-400">Activity</p>
        <p className="mt-0.5 truncate font-semibold text-slate-700">
          {state?.activeTaskCount ? `${state.activeTaskCount} active` : "Idle"}
        </p>
      </div>
      <div className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5">
        <p className="uppercase tracking-[0.12em] text-slate-400">Runtime</p>
        <p className="mt-0.5 truncate font-semibold text-slate-700" title={state?.model ?? "Waiting for runtime"}>
          {state ? `${state.mode === "local" ? "Local" : "Remote"} · ${relativeTime(state.lastSuccessAt)}` : "Checking…"}
        </p>
      </div>
      {state?.currentTaskLabel ? (
        <p className="col-span-3 truncate text-slate-500">Working on: {state.currentTaskLabel}</p>
      ) : null}
    </div>
  );
}
