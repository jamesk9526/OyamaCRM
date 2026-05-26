/**
 * StewardSuggestions renders actionable stewardship intelligence cards
 * based on donor data signals (lapsed donors, major gift thresholds, new donors
 * needing welcome messages, etc.).
 */
"use client";

import Link from "next/link";

interface StewardSuggestion {
  id: string;
  type: "lapsed" | "threshold" | "welcome" | "pending_task" | "retention";
  title: string;
  description: string;
  action: { label: string; href: string };
  count?: number;
  urgency: "high" | "medium" | "low";
}

interface StewardSuggestionsProps {
  suggestions: StewardSuggestion[];
  loading: boolean;
}

const URGENCY_STYLES: Record<string, string> = {
  high: "bg-rose-50 border-rose-100 ring-rose-100",
  medium: "bg-amber-50 border-amber-100 ring-amber-100",
  low: "bg-emerald-50 border-emerald-100 ring-emerald-100",
};

const URGENCY_BADGE: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

const URGENCY_BTN: Record<string, string> = {
  high: "bg-rose-700 hover:bg-rose-800 text-white",
  medium: "bg-amber-600 hover:bg-amber-700 text-white",
  low: "bg-emerald-700 hover:bg-emerald-800 text-white",
};

const TYPE_ICON: Record<string, string> = {
  lapsed: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 9l4-4 4 4 4-4 4 4",
  threshold: "M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7",
  welcome: "M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z",
  pending_task: "M9 11l2 2 4-4M5 5h14v14H5V5z",
  retention: "M4 13h3l2-6 4 12 2-6h5",
};

function SuggestionCard({ suggestion }: { suggestion: StewardSuggestion }) {
  return (
    <div className={`rounded-xl border p-4 ring-1 ${URGENCY_STYLES[suggestion.urgency]}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <svg className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICON[suggestion.type] ?? TYPE_ICON.pending_task} />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">{suggestion.title}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-2">{suggestion.description}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${URGENCY_BADGE[suggestion.urgency]}`}>
          {suggestion.urgency}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {suggestion.count != null ? (
          <p className="text-xs text-slate-400">{suggestion.count.toLocaleString()} {suggestion.count === 1 ? "constituent" : "constituents"} affected</p>
        ) : (
          <div />
        )}
        <Link
          href={suggestion.action.href}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${URGENCY_BTN[suggestion.urgency]}`}
        >
          {suggestion.action.label}
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/** StewardSuggestions — actionable stewardship intelligence for the dashboard. */
export default function StewardSuggestions({ suggestions, loading }: StewardSuggestionsProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Steward Intelligence</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            Data-driven nudges to help you steward better this week
          </p>
        </div>
        <Link href="/steward-paths" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition">
          Steward Paths
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-slate-50" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M12 3v1M3 12h1M20 12h1M12 20v1M5.636 5.636l.707.707M17.657 5.636l-.707.707M17.657 18.364l-.707-.707M5.636 18.364l.707-.707" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-600">All caught up!</p>
          <p className="mt-1 max-w-xs text-xs text-slate-400">No urgent stewardship actions right now. Keep up the great work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.slice(0, 4).map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}
