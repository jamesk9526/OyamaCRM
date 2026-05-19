"use client";

/**
 * StewardThinkingPanel — live progress + tool feed during Steward AI generation.
 *
 * Shows: stage pipeline (Retrieve → Plan → Generate), live tool entries with
 * spinner/checkmark, the latest progress step text, and a collapsible reasoning
 * stream for DeepSeek thinking tokens.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface ActiveTool {
  name: string;
  label: string;
  /** "active" while running, "done" once complete. */
  status: "active" | "done";
}

interface StewardThinkingPanelProps {
  progressSteps: string[];
  thinkingContent: string;
  isActive: boolean;
  compact?: boolean;
  tone?: "dark" | "light";
  /** Live tool feed populated from "tool" stream events. */
  activeTools?: ActiveTool[];
}

type Stage = "retrieve" | "plan" | "generate";

/** Maps a tool name prefix to its pipeline stage. */
const PREFIX_TO_STAGE: Record<string, Stage> = {
  context: "retrieve",
  fiscal: "retrieve",
  donor: "retrieve",
  compassion: "retrieve",
  events: "retrieve",
  watchdog: "retrieve",
  webmaster: "retrieve",
  knowledge: "retrieve",
  reports: "retrieve",
  help: "retrieve",
  memory: "retrieve",
  file: "retrieve",
  agentic: "plan",
  thoughtstack: "plan",
  model: "generate",
  email: "generate",
};

function stageForTool(name: string): Stage {
  const prefix = name.split(".")[0] ?? "";
  return PREFIX_TO_STAGE[prefix] ?? "retrieve";
}

const STAGE_ORDER: Stage[] = ["retrieve", "plan", "generate"];

const STAGE_LABELS: Record<Stage, string> = {
  retrieve: "Retrieve",
  plan: "Plan",
  generate: "Generate",
};

export function StewardThinkingPanel({
  progressSteps,
  thinkingContent,
  isActive,
  compact = false,
  tone = "light",
  activeTools = [],
}: StewardThinkingPanelProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const reasoningRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning panel as new tokens arrive.
  useEffect(() => {
    if (reasoningOpen && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [thinkingContent, reasoningOpen]);

  // Build reasoning paragraph previews for the ticker.
  const paragraphHeadlines = useMemo((): string[] => {
    if (!thinkingContent.trim()) return [];
    return thinkingContent
      .split(/\n\s*\n+/)
      .map((p) => {
        const first = p.trim().split("\n").find((l) => l.trim().length > 0)?.replace(/\s+/g, " ").trim() ?? "";
        return first.length > 84 ? `${first.slice(0, 84)}…` : first;
      })
      .filter((l) => l.length > 0);
  }, [thinkingContent]);

  // Rotate thinking ticker.
  useEffect(() => {
    if (!isActive || paragraphHeadlines.length <= 1) { setTickerIndex(0); return; }
    const t = window.setInterval(() => setTickerIndex((i) => (i + 1) % paragraphHeadlines.length), 1700);
    return () => window.clearInterval(t);
  }, [isActive, paragraphHeadlines.length]);

  // Per-stage status based on accumulated tool events.
  function stageStatus(key: Stage): "done" | "active" | "pending" {
    const tools = activeTools.filter((t) => stageForTool(t.name) === key);
    if (tools.length === 0) return "pending";
    if (tools.some((t) => t.status === "active")) return "active";
    return "done";
  }

  const showPipeline = (activeTools.length > 0 || isActive) && !compact;
  const visibleTools = activeTools.slice(-6);

  const hasContent = progressSteps.length > 0 || thinkingContent.length > 0 || activeTools.length > 0;
  if (!hasContent && !isActive) return null;

  const latestStep = progressSteps.at(-1);
  const isDark = tone === "dark";

  const shellCls = isDark
    ? "border-cyan-400/15 bg-[#101216]/85 text-slate-300 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
    : "border-slate-100 bg-slate-50/80";
  const divCls = isDark ? "border-white/10" : "border-slate-100";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";
  const activeCls = isDark ? "text-cyan-100" : "text-slate-600";

  return (
    <div className={`steward-thinking-panel mb-2 overflow-hidden rounded-xl border ${shellCls} ${compact ? "text-xs" : "text-sm"}`}>
      {isActive && <div className="steward-thinking-scan" aria-hidden="true" />}

      {/* ── Header: status dots + latest step text ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isActive ? (
          <span className="flex shrink-0 items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" style={{ animationDelay: "140ms" }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" style={{ animationDelay: "280ms" }} />
          </span>
        ) : (
          <svg className={`h-3.5 w-3.5 shrink-0 ${mutedCls}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        <span className={`flex-1 truncate ${isActive ? activeCls : mutedCls}`}>
          {isActive ? (latestStep ?? "Steward is thinking…") : (latestStep ?? "Done")}
        </span>

        {progressSteps.length > 1 && !compact && (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
            {progressSteps.length} steps
          </span>
        )}

        {thinkingContent && (
          <button
            type="button"
            onClick={() => setReasoningOpen((v) => !v)}
            className={`ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-cyan-100" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"}`}
            title={reasoningOpen ? "Hide reasoning" : "Show reasoning"}
          >
            <svg className={`h-3 w-3 transition-transform ${reasoningOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {reasoningOpen ? "Hide reasoning" : "Show reasoning"}
          </button>
        )}
      </div>

      {/* ── Stage pipeline: Retrieve → Plan → Generate ── */}
      {showPipeline && (
        <div className={`border-t px-3 py-2 ${divCls}`}>
          <div className="flex items-center">
            {STAGE_ORDER.map((key, idx) => {
              const status = stageStatus(key);
              return (
                <div key={key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300 ${
                    status === "active"
                      ? isDark
                        ? "bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40"
                        : "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300"
                      : status === "done"
                        ? isDark ? "bg-white/5 text-slate-400" : "bg-slate-100 text-slate-500"
                        : isDark ? "text-slate-600" : "text-slate-400"
                  }`}>
                    {status === "active" ? (
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                    ) : status === "done" ? (
                      <svg className="h-3 w-3 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-25" />
                    )}
                    {STAGE_LABELS[key]}
                  </div>
                  {idx < STAGE_ORDER.length - 1 && (
                    <div className={`h-px w-5 ${isDark ? "bg-white/15" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Live tool feed (last 6 tools) ── */}
      {visibleTools.length > 0 && !compact && (
        <div className={`border-t px-3 py-1.5 ${divCls}`}>
          <div className="flex flex-col gap-1">
            {visibleTools.map((tool, idx) => (
              <div key={`${tool.name}-${idx}`} className="steward-tool-entry flex items-center gap-2 text-[11px]">
                {tool.status === "active" ? (
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                    <span className="h-3 w-3 animate-spin rounded-full border border-cyan-400/40 border-t-cyan-400" />
                  </span>
                ) : (
                  <svg className="h-3.5 w-3.5 shrink-0 text-cyan-400/70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className={tool.status === "active" ? activeCls : mutedCls}>
                  {tool.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Thinking ticker (DeepSeek reasoning preview) ── */}
      {isActive && paragraphHeadlines[tickerIndex] && (
        <div className={`border-t px-3 py-1.5 ${divCls}`}>
          <div className={`flex items-center gap-2 text-[11px] ${isDark ? "text-cyan-200/90" : "text-cyan-700"}`}>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="shrink-0 font-medium">Thinking:</span>
            <span key={tickerIndex} className="min-w-0 flex-1 truncate animate-pulse">
              {paragraphHeadlines[tickerIndex]}
            </span>
          </div>
        </div>
      )}

      {/* ── Collapsible reasoning stream ── */}
      {reasoningOpen && thinkingContent && (
        <div className={`border-t ${divCls}`}>
          <div className="px-2 py-1">
            <p className={`mb-1 text-[10px] font-medium uppercase tracking-wide ${mutedCls}`}>Reasoning</p>
            <div
              ref={reasoningRef}
              className={`overflow-y-auto rounded-lg p-2 font-mono text-[10px] leading-relaxed ${isDark ? "bg-black/35 text-slate-300" : "bg-white/70 text-slate-500"} ${compact ? "max-h-28" : "max-h-48"}`}
            >
              <span className="whitespace-pre-wrap break-words">{thinkingContent}</span>
              {isActive && (
                <span className={`ml-0.5 inline-block h-2.5 w-0.5 animate-pulse ${isDark ? "bg-cyan-300" : "bg-slate-400"}`} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
