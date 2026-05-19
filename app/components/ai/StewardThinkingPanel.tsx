"use client";

/**
 * StewardThinkingPanel — shows live progress steps and DeepSeek reasoning tokens
 * while Steward is working on a response. Designed to be subtle and collapsible.
 * Separate from the final answer; never mixes thinking output into the main message.
 */

import { useEffect, useMemo, useRef, useState } from "react";

interface StewardThinkingPanelProps {
  /** Human-readable progress steps sent during pipeline stages. */
  progressSteps: string[];
  /** Raw reasoning tokens from DeepSeek or other thinking-capable models. */
  thinkingContent: string;
  /** Whether Steward is still actively streaming/working. */
  isActive: boolean;
  /** Compact mode for the docked chat panel. */
  compact?: boolean;
  /** Visual tone used by the host chat surface. */
  tone?: "dark" | "light";
}

export function StewardThinkingPanel({
  progressSteps,
  thinkingContent,
  isActive,
  compact = false,
  tone = "light",
}: StewardThinkingPanelProps) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const reasoningRef = useRef<HTMLDivElement>(null);

  const paragraphHeadlines = useMemo(() => {
    if (!thinkingContent.trim()) return [] as string[];

    const previews = thinkingContent
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => {
        const firstLine = paragraph
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.length > 0) ?? "";
        const compactLine = firstLine.replace(/\s+/g, " ").trim();
        return compactLine.length > 84 ? `${compactLine.slice(0, 84)}...` : compactLine;
      })
      .filter((line) => line.length > 0);

    return previews;
  }, [thinkingContent]);

  // Auto-scroll the reasoning panel as new tokens arrive.
  useEffect(() => {
    if (reasoningOpen && reasoningRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [thinkingContent, reasoningOpen]);

  useEffect(() => {
    if (!isActive || paragraphHeadlines.length <= 1) {
      setTickerIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % paragraphHeadlines.length);
    }, 1700);

    return () => window.clearInterval(timer);
  }, [isActive, paragraphHeadlines.length]);

  const hasContent = progressSteps.length > 0 || thinkingContent.length > 0;
  if (!hasContent && !isActive) return null;

  const latestStep = progressSteps.at(-1);
  const isDark = tone === "dark";
  const shellClass = isDark
    ? "border-cyan-400/15 bg-[#101216]/85 text-slate-300 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
    : "border-slate-100 bg-slate-50/80";
  const dividerClass = isDark ? "border-white/10" : "border-slate-100";
  const mutedTextClass = isDark ? "text-slate-400" : "text-slate-500";
  const activeTextClass = isDark ? "text-cyan-100" : "text-slate-600";
  const tickerTextClass = isDark ? "text-cyan-200/90" : "text-cyan-700";
  const currentHeadline = paragraphHeadlines[tickerIndex] ?? paragraphHeadlines[0] ?? "";

  return (
    <div className={`steward-thinking-panel mb-2 overflow-hidden rounded-xl border ${shellClass} ${compact ? "text-xs" : "text-sm"}`}>
      {isActive && <div className="steward-thinking-scan" aria-hidden="true" />}
      {/* Active indicator + latest progress step */}
      <div className="flex items-center gap-2 px-3 py-2">
        {isActive ? (
          <span className="flex shrink-0 items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300"
              style={{ animationDelay: "140ms" }}
            />
            <span
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300"
              style={{ animationDelay: "280ms" }}
            />
          </span>
        ) : (
          <svg
            className={`h-3.5 w-3.5 shrink-0 ${mutedTextClass}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}

        <span className={`flex-1 truncate ${isActive ? activeTextClass : mutedTextClass}`}>
          {isActive
            ? (latestStep ?? "Steward is thinking…")
            : (latestStep ?? "Done")}
        </span>

        {/* Progress step count badge */}
        {progressSteps.length > 1 && !compact && (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
            {progressSteps.length} steps
          </span>
        )}

        {/* Reasoning toggle — only shown when thinking content is available */}
        {thinkingContent && (
          <button
            type="button"
            onClick={() => setReasoningOpen((v) => !v)}
            className={`ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] transition-colors ${isDark ? "text-slate-400 hover:bg-white/10 hover:text-cyan-100" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"}`}
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

      {/* Rolling thinking line: shows the first line of each new reasoning paragraph. */}
      {isActive && currentHeadline && (
        <div className={`border-t px-3 py-1.5 ${dividerClass}`}>
          <div className={`flex items-center gap-2 text-[11px] ${tickerTextClass}`}>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <span className="shrink-0 font-medium">Thinking now:</span>
            <span key={`${tickerIndex}-${currentHeadline.slice(0, 16)}`} className="min-w-0 flex-1 truncate animate-pulse">
              {currentHeadline}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible progress step history (non-compact only) */}
      {!compact && progressSteps.length > 1 && (
        <div className={`border-t px-3 py-1.5 ${dividerClass}`}>
          <div className="flex flex-col gap-0.5">
            {progressSteps.map((step, idx) => (
              <div key={idx} className={`flex items-center gap-1.5 text-[11px] ${mutedTextClass}`}>
                <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                  {idx < progressSteps.length - 1 ? (
                    <svg className="h-2.5 w-2.5 text-cyan-300" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  ) : isActive ? (
                    <svg className="h-2.5 w-2.5 animate-pulse text-cyan-300" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  ) : (
                    <svg className="h-2.5 w-2.5 text-cyan-300" viewBox="0 0 10 10" fill="currentColor">
                      <circle cx="5" cy="5" r="3" />
                    </svg>
                  )}
                </span>
                <span className={idx === progressSteps.length - 1 && isActive ? activeTextClass : ""}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible reasoning stream */}
      {reasoningOpen && thinkingContent && (
        <div className={`border-t ${dividerClass}`}>
          <div className="px-2 py-1">
            <p className={`mb-1 text-[10px] font-medium uppercase tracking-wide ${mutedTextClass}`}>
              Reasoning
            </p>
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
