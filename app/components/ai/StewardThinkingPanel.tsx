"use client";

/**
 * StewardThinkingPanel — inline progress indicator with nonprofit-themed rotating sayings
 * and an estimated animated progress bar. Shown while Steward AI is generating a response.
 */

import { useEffect, useRef, useState } from "react";

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
  /** Estimated completion percentage (0–100) from server pipeline stages. */
  progressPercent?: number;
  /** Current pipeline stage from server: "retrieve" | "plan" | "generate". */
  progressStage?: string;
}

/** Cute nonprofit-themed sayings, indexed by pipeline stage. */
const SAYINGS: Record<string, string[]> = {
  retrieve: [
    "Counting donations, big and small…",
    "Peeking at giving history…",
    "Asking the donor database what's new…",
    "Reading through the stewardship log…",
    "Finding your most loyal supporters…",
    "Sorting generosity by date…",
    "Looking up your kind-hearted donors…",
    "Checking in with the records…",
  ],
  plan: [
    "Figuring out what I'm doing today…",
    "Consulting my nonprofit wisdom…",
    "Mapping out the best response…",
    "Running it by the board… just kidding",
    "Thinking it through, mission-first…",
    "Checking the plan twice…",
    "Making sure I don't miss anything…",
  ],
  generate: [
    "Writing something worth reading…",
    "Putting the mission into words…",
    "Adding just the right amount of heart…",
    "Making it donor-ready…",
    "Polishing the message for you…",
    "One more compassionate pass…",
    "Wrapping up with gratitude…",
  ],
  default: [
    "One moment while I help your mission…",
    "Steward is on it…",
    "Working on something good…",
    "Almost ready…",
  ],
};

export function StewardThinkingPanel({
  progressSteps,
  thinkingContent,
  isActive,
  compact = false,
  tone = "light",
  activeTools = [],
  progressPercent,
  progressStage,
}: StewardThinkingPanelProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [sayingIndex, setSayingIndex] = useState(0);
  const [creepPercent, setCreepPercent] = useState(0);
  const reasoningRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning panel as new tokens arrive.
  useEffect(() => {
    if (reasoningOpen && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [thinkingContent, reasoningOpen]);

  // Rotate sayings while active (every 3.5 s).
  useEffect(() => {
    if (!isActive) { setSayingIndex(0); return; }
    const stage = progressStage ?? "default";
    const pool = SAYINGS[stage] ?? SAYINGS.default;
    const t = window.setInterval(() => setSayingIndex((i) => (i + 1) % pool.length), 3500);
    return () => window.clearInterval(t);
  }, [isActive, progressStage]);

  // Reset saying when stage changes so we always start with index 0 for the new stage.
  useEffect(() => { setSayingIndex(0); }, [progressStage]);

  // Slow creep: advance bar ~0.5 % every 2 s while active so it feels alive between server events.
  useEffect(() => {
    if (!isActive) { setCreepPercent(0); return; }
    const t = window.setInterval(() => {
      setCreepPercent((prev) => {
        const serverPct = progressPercent ?? 0;
        return serverPct + prev >= 91 ? prev : prev + 0.5;
      });
    }, 2000);
    return () => window.clearInterval(t);
  }, [isActive, progressPercent]);

  // Reset creep whenever the server sends a new percent (real progress beat the estimate).
  useEffect(() => { setCreepPercent(0); }, [progressPercent]);

  const stage = progressStage ?? "default";
  const pool = SAYINGS[stage] ?? SAYINGS.default;
  const currentSaying = pool[sayingIndex % pool.length] ?? pool[0] ?? "";

  const serverPct = progressPercent ?? 0;
  const displayPct = isActive ? Math.min(91, serverPct + creepPercent) : 100;

  const hasContent = progressSteps.length > 0 || thinkingContent.length > 0 || activeTools.length > 0;
  if (!hasContent && !isActive) return null;

  const isDark = tone === "dark";

  const shellCls = isDark
    ? "border-cyan-400/15 bg-[#101216]/90 text-slate-300"
    : "border-slate-200 bg-white/95 text-slate-700";
  const divCls = isDark ? "border-white/10" : "border-slate-100";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-400";
  const sayingCls = isDark ? "text-slate-200" : "text-slate-600";
  const barBgCls = isDark ? "bg-white/10" : "bg-slate-100";
  const barFillCls = isDark ? "bg-cyan-400" : "bg-green-500";

  return (
    <div className={`mb-2 overflow-hidden rounded-xl border text-xs ${shellCls}`}>
      {/* ── Header: animated dots + rotating nonprofit saying ── */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isActive ? (
          <span className="flex shrink-0 items-center gap-[3px]">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: "150ms" }} />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-green-500" style={{ animationDelay: "300ms" }} />
          </span>
        ) : (
          <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        <span key={`${stage}-${sayingIndex}`} className={`flex-1 min-w-0 truncate transition-opacity duration-500 ${isActive ? sayingCls : mutedCls}`}>
          {isActive ? currentSaying : (progressSteps.at(-1) ?? "Done")}
        </span>

        {thinkingContent && (
          <button
            type="button"
            onClick={() => setReasoningOpen((v) => !v)}
            className={`ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-cyan-100" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
            title={reasoningOpen ? "Hide reasoning" : "Show reasoning"}
          >
            <svg className={`h-3 w-3 transition-transform ${reasoningOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-[10px]">{reasoningOpen ? "Hide" : "Reasoning"}</span>
          </button>
        )}
      </div>

      {/* ── Estimated progress bar ── */}
      <div className="px-3 pb-2.5">
        <div className={`relative h-1 overflow-hidden rounded-full ${barBgCls}`}>
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${barFillCls}`}
            style={{ width: `${displayPct}%` }}
          />
          {isActive && (
            <div
              className="pointer-events-none absolute inset-y-0 w-10 rounded-full opacity-50 animate-pulse"
              style={{
                left: `${Math.max(0, displayPct - 8)}%`,
                background: isDark
                  ? "linear-gradient(90deg, transparent 0%, rgba(103,232,249,0.5) 50%, transparent 100%)"
                  : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
              }}
            />
          )}
        </div>
      </div>

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

