"use client";

/**
 * StewardThinkingPanel — shows live progress steps and DeepSeek reasoning tokens
 * while Steward is working on a response. Designed to be subtle and collapsible.
 * Separate from the final answer; never mixes thinking output into the main message.
 */

import { useEffect, useRef, useState } from "react";

interface StewardThinkingPanelProps {
  /** Human-readable progress steps sent during pipeline stages. */
  progressSteps: string[];
  /** Raw reasoning tokens from DeepSeek or other thinking-capable models. */
  thinkingContent: string;
  /** Whether Steward is still actively streaming/working. */
  isActive: boolean;
  /** Compact mode for the docked chat panel. */
  compact?: boolean;
}

export function StewardThinkingPanel({
  progressSteps,
  thinkingContent,
  isActive,
  compact = false,
}: StewardThinkingPanelProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const reasoningRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the reasoning panel as new tokens arrive.
  useEffect(() => {
    if (reasoningOpen && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [thinkingContent, reasoningOpen]);

  const hasContent = progressSteps.length > 0 || thinkingContent.length > 0;
  if (!hasContent && !isActive) return null;

  const latestStep = progressSteps.at(-1);

  return (
    <div className={`mb-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 ${compact ? "text-xs" : "text-sm"}`}>
      {/* Active indicator + latest progress step */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isActive ? (
          <span className="flex shrink-0 items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500"
              style={{ animationDelay: "140ms" }}
            />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500"
              style={{ animationDelay: "280ms" }}
            />
          </span>
        ) : (
          <svg
            className="h-3.5 w-3.5 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        <span className={`flex-1 truncate ${isActive ? "text-slate-600" : "text-slate-500"}`}>
          {isActive
            ? (latestStep ?? "Steward is thinking…")
            : (latestStep ?? "Done")}
        </span>

        {/* Progress step count badge */}
        {progressSteps.length > 1 && !compact && (
          <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
            {progressSteps.length} steps
          </span>
        )}

        {/* Reasoning toggle — only shown when thinking content is available */}
        {thinkingContent && (
          <button
            type="button"
            onClick={() => setReasoningOpen((v) => !v)}
            className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            title={reasoningOpen ? "Hide reasoning" : "Show reasoning"}
          >
            <svg
              className={`h-3 w-3 transition-transform ${reasoningOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {reasoningOpen ? "Hide reasoning" : "Show reasoning"}
          </button>
        )}
      </div>

      {/* Collapsible progress step history (non-compact only) */}
      {!compact && progressSteps.length > 1 && (
        <div className="border-t border-slate-100 px-3 py-1.5">
          <div className="flex flex-col gap-0.5">
            {progressSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  {idx < progressSteps.length - 1 ? (
                    <svg className="h-2.5 w-2.5 text-emerald-500" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  ) : isActive ? (
                    <svg className="h-2.5 w-2.5 animate-pulse text-emerald-400" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  ) : (
                    <svg className="h-2.5 w-2.5 text-emerald-500" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  )}
                </span>
                <span className={idx === progressSteps.length - 1 && isActive ? "text-slate-600" : ""}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible reasoning stream */}
      {reasoningOpen && thinkingContent && (
        <div className="border-t border-slate-100">
          <div className="px-2 py-1">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Reasoning
            </p>
            <div
              ref={reasoningRef}
              className={`overflow-y-auto rounded-lg bg-white/70 p-2 font-mono text-[10px] leading-relaxed text-slate-500 ${compact ? "max-h-28" : "max-h-48"}`}
            >
              <span className="whitespace-pre-wrap break-words">{thinkingContent}</span>
              {isActive && (
                <span className="ml-0.5 inline-block h-2.5 w-0.5 animate-pulse bg-slate-400" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
